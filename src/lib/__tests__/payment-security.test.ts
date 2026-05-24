import { describe, it, expect } from "vitest";
import * as fs from "fs";

// ─── P0.9 Payment & Reservation Security Test Suite ───
// Validates all CNIL / PCI DSS requirements for payment handling.

const readCode = (p: string) => fs.readFileSync(p, "utf-8");

// ══════════════════════════════════════════════════════════════════════
// 1. Carte bancaire jamais stockée par Tuatha
// ══════════════════════════════════════════════════════════════════════

describe("No card data stored (PCI DSS)", () => {
  it("PCI module defines FORBIDDEN_PATTERNS for card fields", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/pci.ts");
    expect(code).toContain("FORBIDDEN_PATTERNS");
    expect(code).toContain("card.?number");
    expect(code).toContain("cvv");
    expect(code).toContain("cvc");
    expect(code).toContain("exp.?month");
  });

  it("PCI module provides stripCardData sanitizer", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/pci.ts");
    expect(code).toContain("export function stripCardData");
    expect(code).toContain("delete clean[key");
  });

  it("PCI module provides assertNoCardData for tests", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/pci.ts");
    expect(code).toContain("export function assertNoCardData");
    expect(code).toContain("PCI VIOLATION");
  });

  it("PCI module rejects pm_ (PaymentMethod) IDs", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/pci.ts");
    expect(code).toContain('if (id.startsWith("pm_")) return false');
  });

  it("Payment model has NO card data fields in Prisma schema", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const paymentModel = schema.slice(
      schema.indexOf("model Payment {"),
      schema.indexOf("}", schema.indexOf("model Payment {")) + 1,
    );
    expect(paymentModel).not.toContain("cardNumber");
    expect(paymentModel).not.toContain("cardPan");
    expect(paymentModel).not.toContain("cvv");
    expect(paymentModel).not.toContain("cvc");
    expect(paymentModel).not.toContain("expMonth");
    expect(paymentModel).not.toContain("expYear");
    expect(paymentModel).not.toContain("fingerprint");
    expect(paymentModel).not.toContain("paymentMethodId");
  });

  it("Payment model has PCI comment in schema", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    expect(schema).toContain("PCI DSS / CNIL : AUCUNE donnée de carte");
  });

  it("create-checkout applies stripCardData on request body", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");
    expect(code).toContain("stripCardData");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 2. Paiement via prestataire Stripe
// ══════════════════════════════════════════════════════════════════════

describe("Payment via Stripe Checkout (hosted)", () => {
  it("uses Stripe Checkout Session (not custom card form)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");
    expect(code).toContain("stripe.checkout.sessions.create");
    expect(code).toContain('mode: "payment"');
  });

  it("uses Stripe Connect destination charges", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");
    expect(code).toContain("transfer_data");
    expect(code).toContain("application_fee_amount");
  });

  it("webhook verifies Stripe signature", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain("stripe.webhooks.constructEvent");
    expect(code).toContain("stripe-signature");
  });

  it("webhook has PCI DSS comment header", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain("PCI DSS / CNIL");
    expect(code).toContain("AUCUNE donnée de carte");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 3. Données paiement séparées des données santé
// ══════════════════════════════════════════════════════════════════════

describe("Payment data separated from health data", () => {
  it("Payment model has no health data fields", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const paymentModel = schema.slice(
      schema.indexOf("model Payment {"),
      schema.indexOf("}", schema.indexOf("model Payment {")) + 1,
    );
    expect(paymentModel).not.toContain("diagnostic");
    expect(paymentModel).not.toContain("ordonnance");
    expect(paymentModel).not.toContain("pathologie");
    expect(paymentModel).not.toContain("antecedent");
    expect(paymentModel).not.toContain("symptom");
    expect(paymentModel).not.toContain("bilan");
    expect(paymentModel).not.toContain("medical");
  });

  it("Invoice model has no health data fields", () => {
    const schema = readCode("/Users/quentin/Desktop/Tuatha-pro/prisma/schema.prisma");
    const invoiceModel = schema.slice(
      schema.indexOf("model Invoice {"),
      schema.indexOf("}", schema.indexOf("model Invoice {")) + 1,
    );
    expect(invoiceModel).not.toContain("diagnostic");
    expect(invoiceModel).not.toContain("ordonnance");
    expect(invoiceModel).not.toContain("pathologie");
    expect(invoiceModel).not.toContain("antecedent");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 4. Aucun détail médical dans les métadonnées Stripe
// ══════════════════════════════════════════════════════════════════════

describe("No medical data in Stripe metadata", () => {
  it("Stripe checkout metadata only contains IDs and flags", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");

    // Extract the metadata blocks sent to Stripe
    const stripeCreateCall = code.slice(code.indexOf("stripe.checkout.sessions.create"));
    const metadataSection = stripeCreateCall.slice(0, stripeCreateCall.indexOf("success_url"));

    // Should contain only IDs
    expect(metadataSection).toContain("calendarEventId");
    expect(metadataSection).toContain("professionnelId");
    expect(metadataSection).toContain("athleteUserId");
    expect(metadataSection).toContain("tuatha_payment");

    // Must NOT contain any health data
    expect(metadataSection).not.toContain("diagnostic");
    expect(metadataSection).not.toContain("pathologie");
    expect(metadataSection).not.toContain("symptom");
    expect(metadataSection).not.toContain("motif");
    expect(metadataSection).not.toContain("ordonnance");
    expect(metadataSection).not.toContain("antecedent");
  });

  it("product_data.name uses generic tarif label, not medical info", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");
    // The product name is: `${description} — ${pro.prenom} ${pro.nom}`
    // where description = tarif.label (e.g. "Consultation présentielle")
    expect(code).toContain("product_data");
    expect(code).toContain("name: `${description}");
    // NOT using medical motif or diagnostic as product name
    expect(code).not.toContain("motif");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 5. Aucun intitulé sensible sur facture
// ══════════════════════════════════════════════════════════════════════

describe("No sensitive label on invoices/receipts", () => {
  it("receipt module has no medical fields", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/receipt.ts");
    expect(code).not.toContain("diagnostic");
    expect(code).not.toContain("pathologie");
    expect(code).not.toContain("ordonnance");
    expect(code).not.toContain("antecedent");
    expect(code).not.toContain("symptom");
  });

  it("auto-created invoice uses generic description", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    // Invoice description is: payment.description || "Consultation"
    expect(code).toContain('description: payment.description || "Consultation"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 6. Historique de paiement visible
// ══════════════════════════════════════════════════════════════════════

describe("Payment history accessible", () => {
  it("athlete can view payment history via authenticated route", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/payments-history/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("athleteUserId: session.id");
  });

  it("pro has financial ledger with pagination and CSV export", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/ledger/route.ts");
    expect(code).toContain("getSessionPro");
    expect(code).toContain("professionnelId: session.id");
    expect(code).toContain("csv");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 7. Factures accessibles
// ══════════════════════════════════════════════════════════════════════

describe("Invoices / receipts accessible", () => {
  it("receipt route exists and checks ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/receipt/[id]/route.ts");
    expect(code).toContain("getSessionAthlete");
    expect(code).toContain("payment.athleteUserId !== session.id");
  });

  it("receipt generates HTML output", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/receipt/[id]/route.ts");
    expect(code).toContain("generateReceiptHtml");
    expect(code).toContain("text/html");
  });

  it("webhook auto-creates invoices on payment success", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain("invoice.create");
    expect(code).toContain("invoiceNumber");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 8. Remboursement possible côté back-office
// ══════════════════════════════════════════════════════════════════════

describe("Refund back-office", () => {
  it("refund route exists and is authenticated via withAuth", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/refund/route.ts");
    expect(code).toContain("withAuth");
    expect(code).toContain("stripe.refunds.create");
  });

  it("refund route checks payment ownership", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/refund/route.ts");
    expect(code).toContain("payment.professionnelId !== ctx.session.id");
  });

  it("refund supports partial and full amounts", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/refund/route.ts");
    expect(code).toContain("maxRefundable");
    expect(code).toContain("refundAmountCents");
  });

  it("refund has finance audit logging (separated from health logs)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/refund/route.ts");
    expect(code).toContain("[FINANCE-AUDIT] REFUND_INITIATED");
  });

  it("webhook handles charge.refunded events", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain('"charge.refunded"');
    expect(code).toContain("isFullRefund");
  });

  it("webhook sends refund email to athlete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain("sendRefundEmail");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 9. Annulation tracée
// ══════════════════════════════════════════════════════════════════════

describe("Cancellation traced", () => {
  it("cancel-appointment route soft-deletes with reason", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/cancel-appointment/route.ts");
    expect(code).toContain("deletedAt");
    expect(code).toContain("deletedBy");
    expect(code).toContain("cancelTag");
  });

  it("cancellation eligibility determines refund policy", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/cancellation.ts");
    expect(code).toContain("getCancellationEligibility");
    expect(code).toContain("full_refund");
    expect(code).toContain("pro_policy");
    expect(code).toContain("no_refund");
  });

  it("cancellation sends email to both athlete and pro", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/cancel-appointment/route.ts");
    expect(code).toContain("sendCancellationEmail");
    // Two calls — one to athlete, one to pro
    const matches = code.match(/sendCancellationEmail/g);
    expect(matches?.length).toBeGreaterThanOrEqual(2);
  });

  it("webhook marks expired checkout as cancelled", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain('"checkout.session.expired"');
    expect(code).toContain("cancelled");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 10. Litige traçable
// ══════════════════════════════════════════════════════════════════════

describe("Dispute traceable", () => {
  it("webhook handles charge.dispute.created", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain('"charge.dispute.created"');
    expect(code).toContain("dispute_open");
  });

  it("webhook handles charge.dispute.closed (won/lost)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain('"charge.dispute.closed"');
    expect(code).toContain('closedDispute.status === "won"');
  });

  it("payment status model includes dispute_open", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/paymentStatus.ts");
    expect(code).toContain("dispute_open");
    expect(code).toContain("isDisputed");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 11. Paiement échoué géré proprement
// ══════════════════════════════════════════════════════════════════════

describe("Failed payment handled properly", () => {
  it("webhook handles payment_intent.payment_failed", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain('"payment_intent.payment_failed"');
    expect(code).toContain("payment_failed");
  });

  it("sends failure email to athlete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain("sendPaymentFailedEmail");
  });

  it("creates in-app notification for failed payment", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/webhook/route.ts");
    expect(code).toContain('type: "payment_failed"');
  });

  it("payment_failed is a terminal status", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/paymentStatus.ts");
    expect(code).toContain("TERMINAL_NEGATIVE_STATUSES");
    expect(code).toContain('"payment_failed"');
  });
});

// ══════════════════════════════════════════════════════════════════════
// 12. Paiement réussi ne donne pas accès à des données non autorisées
// ══════════════════════════════════════════════════════════════════════

describe("Successful payment does not grant unauthorized data access", () => {
  it("create-checkout checks athlete ownership of calendar event", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");
    expect(code).toContain("event.athleteUserId !== session.id");
  });

  it("create-checkout requires athlete authentication", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");
    expect(code).toContain("getSessionAthlete");
  });

  it("receipt access is scoped to owning athlete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/receipt/[id]/route.ts");
    expect(code).toContain("payment.athleteUserId !== session.id");
    expect(code).toContain("Accès non autorisé");
  });

  it("payment history is scoped to authenticated athlete", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/athlete/payments-history/route.ts");
    expect(code).toContain("athleteUserId: session.id");
  });

  it("ledger is scoped to authenticated pro", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/ledger/route.ts");
    expect(code).toContain("professionnelId: session.id");
  });

  it("refund is scoped to owning pro", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/refund/route.ts");
    expect(code).toContain("payment.professionnelId !== ctx.session.id");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 13. Finance logs separated from health logs
// ══════════════════════════════════════════════════════════════════════

describe("Finance logs separated from health logs", () => {
  it("refund uses [FINANCE-AUDIT] prefix, not [AUDIT]", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/refund/route.ts");
    expect(code).toContain("[FINANCE-AUDIT]");
    expect(code).not.toContain("[AUDIT]");
  });

  it("payment statuses have structured lifecycle (no health coupling)", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/paymentStatus.ts");
    expect(code).toContain("ALLOWED_TRANSITIONS");
    expect(code).toContain("canTransition");
  });
});

// ══════════════════════════════════════════════════════════════════════
// 14. Stripe metadata review
// ══════════════════════════════════════════════════════════════════════

describe("Stripe metadata review (complete)", () => {
  it("local Payment metadata stores eventTitle but it is NOT sent to Stripe", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/app/api/payments/create-checkout/route.ts");
    // eventTitle is in local JSON metadata
    expect(code).toContain("eventTitle: event.title");
    // But the stripe.checkout.sessions.create call does NOT use event.title
    const stripeCall = code.slice(
      code.indexOf("stripe.checkout.sessions.create"),
      code.indexOf("success_url"),
    );
    expect(stripeCall).not.toContain("event.title");
    expect(stripeCall).not.toContain("eventTitle");
  });

  it("Stripe SDK is server-only", () => {
    const code = readCode("/Users/quentin/Desktop/Tuatha-pro/src/lib/stripe.ts");
    expect(code).toContain("NEVER import this file from client components");
  });
});
