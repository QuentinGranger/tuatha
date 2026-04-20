// PCI DSS / CNIL : Ce webhook ne traite que des IDs Stripe (session, payment_intent, charge).
// AUCUNE donnée de carte (PAN, CVV, empreinte) n'est extraite, stockée ou loguée.
// Voir src/lib/pci.ts pour la politique complète.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import Stripe from "stripe";
import { generateReceiptNumber, getReceiptData, generateReceiptEmailHtml } from "@/lib/receipt";
import { sendReceiptEmail } from "@/lib/mailer";
import { PAYMENT_STATUSES, isPaid } from "@/lib/paymentStatus";
import { computeAccountStatus } from "@/lib/accountStatus";
import { sendPaymentConfirmationEmail, sendPaymentFailedEmail, sendRefundEmail } from "@/lib/email";

/**
 * POST /api/payments/webhook
 *
 * Stripe webhook endpoint — single route for BOTH platform and Connect events.
 *
 * Platform events:
 * - checkout.session.completed → mark payment as paid + receipt + invoice
 * - checkout.session.expired   → mark payment as cancelled
 * - charge.refunded            → mark payment as refunded / refund_partial
 * - payment_intent.payment_failed → mark payment as payment_failed
 * - charge.dispute.created     → mark payment as dispute_open
 * - charge.dispute.closed      → resolve dispute (paid or refunded)
 *
 * Connect events (from connected accounts):
 * - account.updated            → sync Stripe Connect account status
 * - transfer.created           → mark payment as payout_pending
 * - payout.paid                → mark payout_pending payments as payout_sent
 *
 * Must be configured in Stripe Dashboard → Webhooks with the events above.
 * The webhook secret must be set in STRIPE_WEBHOOK_SECRET env var.
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret || webhookSecret === "whsec_VOTRE_WEBHOOK_SECRET") {
    console.error("STRIPE_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      // ── Checkout completed → payment successful ──
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Only process Tuatha payments
        if (session.metadata?.tuatha_payment !== "true") break;

        const payment = await prisma.payment.findUnique({
          where: { stripeCheckoutSessionId: session.id },
        });

        if (!payment) {
          console.warn(`Webhook: no payment found for checkout session ${session.id}`);
          break;
        }

        if (isPaid(payment.status)) break; // idempotent

        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id || null;

        // Generate receipt number
        const receiptNumber = await generateReceiptNumber();

        // ── Extract Stripe fee from balance_transaction for ledger ──
        let stripeFee: number | null = null;
        try {
          if (paymentIntentId) {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ["latest_charge.balance_transaction"],
            });
            const latestCharge = pi.latest_charge as Stripe.Charge | null;
            const bt = latestCharge?.balance_transaction as Stripe.BalanceTransaction | null;
            if (bt?.fee != null) {
              stripeFee = bt.fee; // in cents
            }
          }
        } catch (feeErr) {
          console.warn(`Could not retrieve Stripe fee for payment ${payment.id}:`, feeErr);
        }

        const netAmount = payment.amount - payment.platformFee;

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: PAYMENT_STATUSES.paid,
            paidAt: new Date(),
            stripePaymentIntentId: paymentIntentId,
            stripeFee,
            netAmount,
            receiptNumber,
            receiptGeneratedAt: new Date(),
          },
        });

        console.log(`Payment ${payment.id} marked as paid (session: ${session.id}), receipt: ${receiptNumber}, stripeFee: ${stripeFee}, net: ${netAmount}`);

        // Generate and send receipt email (non-blocking — don't fail webhook on email error)
        try {
          const receiptData = await getReceiptData(payment.id);
          if (receiptData) {
            const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
            const downloadUrl = `${baseUrl}/api/payments/receipt/${payment.id}`;
            const emailHtml = generateReceiptEmailHtml(receiptData, downloadUrl);

            await sendReceiptEmail({
              to: receiptData.athleteEmail,
              athletePrenom: receiptData.athletePrenom,
              proNom: receiptData.proNom,
              proPrenom: receiptData.proPrenom,
              receiptNumber,
              receiptHtml: emailHtml,
            });

            await prisma.payment.update({
              where: { id: payment.id },
              data: { receiptEmailSentAt: new Date() },
            });
          }
        } catch (emailErr) {
          console.error(`Failed to send receipt email for payment ${payment.id}:`, emailErr);
        }

        // ── Send payment confirmation email (non-blocking) ──
        try {
          const paymentWithRelations = await prisma.payment.findUnique({
            where: { id: payment.id },
            include: {
              athleteUser: { select: { email: true, prenom: true } },
              professionnel: { select: { nom: true, prenom: true, specialite: true } },
              calendarEvent: { select: { date: true } },
            },
          });
          if (paymentWithRelations?.athleteUser?.email) {
            const eventDate = paymentWithRelations.calendarEvent?.date;
            const dateStr = eventDate
              ? eventDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
              : "—";
            const heureStr = eventDate
              ? eventDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
              : "—";
            const proFullName = `${paymentWithRelations.professionnel.prenom || ""} ${paymentWithRelations.professionnel.nom || ""}`.trim();
            await sendPaymentConfirmationEmail({
              to: paymentWithRelations.athleteUser.email,
              athletePrenom: paymentWithRelations.athleteUser.prenom || "Patient",
              proName: proFullName,
              proSpecialite: paymentWithRelations.professionnel.specialite || "Professionnel de santé",
              amount: `${(payment.amount / 100).toFixed(2).replace(".", ",")} €`,
              date: dateStr,
              heure: heureStr,
              description: payment.description || "Consultation",
              receiptNumber,
            });
            console.log(`Payment confirmation email sent for payment ${payment.id}`);
          }
        } catch (confirmEmailErr) {
          console.error(`Failed to send payment confirmation email for payment ${payment.id}:`, confirmEmailErr);
        }

        // ── Create in-app notification for athlete ──
        try {
          if (payment.athleteUserId && payment.calendarEventId) {
            const proForNotif = await prisma.professionnel.findUnique({
              where: { id: payment.professionnelId },
              select: { nom: true, prenom: true },
            });
            const proName = proForNotif ? `${proForNotif.prenom || ""} ${proForNotif.nom || ""}`.trim() : "Professionnel";
            const amountLabel = `${(payment.amount / 100).toFixed(2).replace(".", ",")} €`;

            await prisma.bookingReminder.create({
              data: {
                calendarEventId: payment.calendarEventId,
                athleteUserId: payment.athleteUserId,
                professionnelId: payment.professionnelId,
                type: "payment_confirmed",
                scheduledAt: new Date(),
                sentAt: new Date(),
                channel: "inapp",
                eventTitle: payment.description || "Consultation",
                eventDate: new Date(),
                eventFormat: "presentiel",
                eventMotif: `Paiement de ${amountLabel} confirmé — ${proName}`,
              },
            });
          }
        } catch (notifErr) {
          console.error(`Failed to create in-app payment notification for ${payment.id}:`, notifErr);
        }

        // ── Auto-create pro-side invoice ──
        try {
          const existingInvoice = await (prisma as any).invoice.findUnique({
            where: { paymentId: payment.id },
          });
          if (!existingInvoice) {
            const year = new Date().getFullYear();
            const invoiceCount = await (prisma as any).invoice.count({
              where: { professionnelId: payment.professionnelId },
            });
            const invoiceNumber = `FAC-${year}-${String(invoiceCount + 1).padStart(3, "0")}`;

            await (prisma as any).invoice.create({
              data: {
                number: invoiceNumber,
                description: payment.description || "Consultation",
                amount: (payment.amount - payment.platformFee) / 100, // net amount in euros
                status: "paid",
                dueDate: new Date(),
                paidDate: new Date(),
                paymentMethod: "Carte bancaire (Stripe)",
                source: "stripe",
                paymentId: payment.id,
                prestationType: payment.prestationType || null,
                athleteUserId: payment.athleteUserId,
                professionnelId: payment.professionnelId,
              },
            });
            console.log(`Invoice ${invoiceNumber} auto-created for payment ${payment.id}`);
          }
        } catch (invoiceErr) {
          console.error(`Failed to auto-create invoice for payment ${payment.id}:`, invoiceErr);
        }

        break;
      }

      // ── Checkout expired → mark payment cancelled ──
      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.tuatha_payment !== "true") break;

        await prisma.payment.updateMany({
          where: {
            stripeCheckoutSessionId: session.id,
            status: { in: [PAYMENT_STATUSES.payment_pending, "pending"] },
          },
          data: { status: PAYMENT_STATUSES.cancelled },
        });

        console.log(`Payment cancelled (expired) for checkout session ${session.id}`);
        break;
      }

      // ── Refund processed ──
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id || null;

        if (!paymentIntentId) break;

        const payment = await prisma.payment.findFirst({
          where: { stripePaymentIntentId: paymentIntentId },
        });

        if (!payment) break;

        // Detect partial vs full refund
        const amountRefunded = charge.amount_refunded || 0;
        const amountTotal = charge.amount || 0;
        const isFullRefund = amountRefunded >= amountTotal;

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: isFullRefund ? PAYMENT_STATUSES.refunded : PAYMENT_STATUSES.refund_partial,
            refundedAt: new Date(),
            refundAmount: amountRefunded,
          },
        });

        console.log(`Payment ${payment.id} marked as ${isFullRefund ? "refunded" : "refund_partial"} (${amountRefunded}/${amountTotal})`);

        // Send refund email (non-blocking)
        try {
          const refundedPayment = await prisma.payment.findUnique({
            where: { id: payment.id },
            include: {
              athleteUser: { select: { email: true, prenom: true } },
              professionnel: { select: { nom: true, prenom: true } },
            },
          });
          if (refundedPayment?.athleteUser?.email) {
            const proFullName = `${refundedPayment.professionnel.prenom || ""} ${refundedPayment.professionnel.nom || ""}`.trim();
            await sendRefundEmail({
              to: refundedPayment.athleteUser.email,
              athletePrenom: refundedPayment.athleteUser.prenom || "Patient",
              proName: proFullName,
              originalAmount: `${(amountTotal / 100).toFixed(2).replace(".", ",")} €`,
              refundAmount: `${(amountRefunded / 100).toFixed(2).replace(".", ",")} €`,
              isPartial: !isFullRefund,
              description: payment.description || "Consultation",
            });
            console.log(`Refund email sent for payment ${payment.id}`);
          }
        } catch (refundEmailErr) {
          console.error(`Failed to send refund email for payment ${payment.id}:`, refundEmailErr);
        }

        // Create in-app notification for athlete
        try {
          if (payment.athleteUserId && payment.calendarEventId) {
            const proForNotif = await prisma.professionnel.findUnique({
              where: { id: payment.professionnelId },
              select: { nom: true, prenom: true },
            });
            const proName = proForNotif ? `${proForNotif.prenom || ""} ${proForNotif.nom || ""}`.trim() : "Professionnel";
            const refundLabel = `${(amountRefunded / 100).toFixed(2).replace(".", ",")} €`;
            const typeLabel = isFullRefund ? "Remboursement intégral" : "Remboursement partiel";

            await prisma.bookingReminder.create({
              data: {
                calendarEventId: payment.calendarEventId,
                athleteUserId: payment.athleteUserId,
                professionnelId: payment.professionnelId,
                type: "refund_processed",
                scheduledAt: new Date(),
                sentAt: new Date(),
                channel: "inapp",
                eventTitle: payment.description || "Consultation",
                eventDate: new Date(),
                eventFormat: "presentiel",
                eventMotif: `${typeLabel} de ${refundLabel} — ${proName}`,
              },
            });
          }
        } catch (notifErr) {
          console.error(`Failed to create in-app refund notification for ${payment.id}:`, notifErr);
        }

        break;
      }

      // ── Payment failed ──
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;

        const payment = await prisma.payment.findFirst({
          where: { stripePaymentIntentId: pi.id },
        });

        if (payment && (payment.status === PAYMENT_STATUSES.payment_pending || payment.status === "pending")) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: { status: PAYMENT_STATUSES.payment_failed },
          });
          console.log(`Payment ${payment.id} marked as payment_failed`);

          // Send payment failed email (non-blocking)
          try {
            const failedPayment = await prisma.payment.findUnique({
              where: { id: payment.id },
              include: {
                athleteUser: { select: { email: true, prenom: true } },
                professionnel: { select: { nom: true, prenom: true } },
              },
            });
            if (failedPayment?.athleteUser?.email) {
              const proFullName = `${failedPayment.professionnel.prenom || ""} ${failedPayment.professionnel.nom || ""}`.trim();
              await sendPaymentFailedEmail({
                to: failedPayment.athleteUser.email,
                athletePrenom: failedPayment.athleteUser.prenom || "Patient",
                proName: proFullName,
                amount: `${(payment.amount / 100).toFixed(2).replace(".", ",")} €`,
                description: payment.description || "Consultation",
                retryUrl: null,
              });
              console.log(`Payment failed email sent for payment ${payment.id}`);
            }
          } catch (failEmailErr) {
            console.error(`Failed to send payment failed email for payment ${payment.id}:`, failEmailErr);
          }

          // Create in-app notification for athlete
          try {
            if (payment.athleteUserId && payment.calendarEventId) {
              const proForNotif = await prisma.professionnel.findUnique({
                where: { id: payment.professionnelId },
                select: { nom: true, prenom: true },
              });
              const proName = proForNotif ? `${proForNotif.prenom || ""} ${proForNotif.nom || ""}`.trim() : "Professionnel";
              const amountLabel = `${(payment.amount / 100).toFixed(2).replace(".", ",")} €`;

              await prisma.bookingReminder.create({
                data: {
                  calendarEventId: payment.calendarEventId,
                  athleteUserId: payment.athleteUserId,
                  professionnelId: payment.professionnelId,
                  type: "payment_failed",
                  scheduledAt: new Date(),
                  sentAt: new Date(),
                  channel: "inapp",
                  eventTitle: payment.description || "Consultation",
                  eventDate: new Date(),
                  eventFormat: "presentiel",
                  eventMotif: `Paiement de ${amountLabel} échoué — ${proName}`,
                },
              });
            }
          } catch (notifErr) {
            console.error(`Failed to create in-app payment_failed notification for ${payment.id}:`, notifErr);
          }
        }
        break;
      }

      // ── Dispute opened (chargeback) ──
      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id;

        if (!chargeId) break;

        // Retrieve the charge to find the payment_intent
        const disputeCharge = await stripe.charges.retrieve(chargeId);
        const piId =
          typeof disputeCharge.payment_intent === "string"
            ? disputeCharge.payment_intent
            : disputeCharge.payment_intent?.id || null;

        if (!piId) break;

        const disputePayment = await prisma.payment.findFirst({
          where: { stripePaymentIntentId: piId },
        });

        if (disputePayment) {
          await prisma.payment.update({
            where: { id: disputePayment.id },
            data: { status: PAYMENT_STATUSES.dispute_open },
          });
          console.log(`Payment ${disputePayment.id} marked as dispute_open (dispute: ${dispute.id})`);
        }
        break;
      }

      // ── Dispute closed (won / lost) ──
      case "charge.dispute.closed": {
        const closedDispute = event.data.object as Stripe.Dispute;
        const closedChargeId =
          typeof closedDispute.charge === "string" ? closedDispute.charge : closedDispute.charge?.id;

        if (!closedChargeId) break;

        const closedCharge = await stripe.charges.retrieve(closedChargeId);
        const closedPiId =
          typeof closedCharge.payment_intent === "string"
            ? closedCharge.payment_intent
            : closedCharge.payment_intent?.id || null;

        if (!closedPiId) break;

        const closedPayment = await prisma.payment.findFirst({
          where: { stripePaymentIntentId: closedPiId },
        });

        if (closedPayment && closedPayment.status === PAYMENT_STATUSES.dispute_open) {
          // Stripe dispute statuses: won → merchant wins (keep funds), lost → refunded
          const newStatus = closedDispute.status === "won"
            ? PAYMENT_STATUSES.paid
            : PAYMENT_STATUSES.refunded;
          await prisma.payment.update({
            where: { id: closedPayment.id },
            data: {
              status: newStatus,
              ...(newStatus === PAYMENT_STATUSES.refunded ? { refundedAt: new Date() } : {}),
            },
          });
          console.log(`Dispute ${closedDispute.id} closed (${closedDispute.status}) → payment ${closedPayment.id} → ${newStatus}`);
        }
        break;
      }

      // ═══════════════════════════════════════
      // ── Connect events (connected accounts) ──
      // ═══════════════════════════════════════

      // ── Connected account updated ──
      case "account.updated": {
        const account = event.data.object as Stripe.Account;

        const pro = await prisma.professionnel.findFirst({
          where: { stripeAccountId: account.id },
        });

        if (!pro) {
          console.warn(`Webhook account.updated: no pro found for Stripe account ${account.id}`);
          break;
        }

        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const detailsSubmitted = account.details_submitted ?? false;

        const updatedPro = await prisma.professionnel.update({
          where: { id: pro.id },
          data: {
            stripeChargesEnabled: chargesEnabled,
            stripePayoutsEnabled: payoutsEnabled,
            stripeDetailsSubmitted: detailsSubmitted,
            stripeOnboardingComplete: detailsSubmitted,
          },
        });

        // Recompute account status
        const newStatus = computeAccountStatus(updatedPro);
        if (newStatus !== updatedPro.accountStatus) {
          await prisma.professionnel.update({
            where: { id: pro.id },
            data: { accountStatus: newStatus },
          });
          console.log(`Pro ${pro.id} account status: ${updatedPro.accountStatus} → ${newStatus}`);
        }

        console.log(`Stripe account ${account.id} synced: charges=${chargesEnabled}, payouts=${payoutsEnabled}, details=${detailsSubmitted}`);
        break;
      }

      // ── Transfer created (platform → connected account) ──
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;

        // source_transaction is the charge on the platform that triggered this transfer
        const sourceTransaction = transfer.source_transaction;
        if (!sourceTransaction) break;

        // Retrieve the charge to find the payment_intent
        try {
          const sourceChargeId =
            typeof sourceTransaction === "string" ? sourceTransaction : sourceTransaction.id;
          const sourceCharge = await stripe.charges.retrieve(sourceChargeId);
          const transferPiId =
            typeof sourceCharge.payment_intent === "string"
              ? sourceCharge.payment_intent
              : sourceCharge.payment_intent?.id || null;

          if (!transferPiId) break;

          const transferPayment = await prisma.payment.findFirst({
            where: { stripePaymentIntentId: transferPiId },
          });

          if (transferPayment && transferPayment.status === PAYMENT_STATUSES.paid) {
            await prisma.payment.update({
              where: { id: transferPayment.id },
              data: { status: PAYMENT_STATUSES.payout_pending },
            });
            console.log(`Payment ${transferPayment.id} → payout_pending (transfer: ${transfer.id})`);
          }
        } catch (transferErr) {
          console.error(`Failed to process transfer.created ${transfer.id}:`, transferErr);
        }
        break;
      }

      // ── Payout sent to pro's bank account ──
      case "payout.paid": {
        // event.account = connected account ID for Connect events
        const connectedAccountId = (event as any).account as string | undefined;
        if (!connectedAccountId) break;

        const payoutPro = await prisma.professionnel.findFirst({
          where: { stripeAccountId: connectedAccountId },
        });

        if (!payoutPro) break;

        // Mark all payout_pending payments for this pro as payout_sent
        const payoutNow = new Date();
        const updated = await prisma.payment.updateMany({
          where: {
            professionnelId: payoutPro.id,
            status: PAYMENT_STATUSES.payout_pending,
          },
          data: {
            status: PAYMENT_STATUSES.payout_sent,
            payoutAt: payoutNow,
          },
        });

        if (updated.count > 0) {
          console.log(`${updated.count} payment(s) → payout_sent for pro ${payoutPro.id} (account: ${connectedAccountId})`);
        }
        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

// Stripe webhooks need the raw body — disable Next.js body parsing
export const dynamic = "force-dynamic";
