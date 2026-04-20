"use client";

import { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { getCroppedImg } from "@/lib/cropImage";
import styles from "./AvatarCropModal.module.scss";

interface AvatarCropModalProps {
  imageSrc: string;
  onCropDone: (croppedFile: File, previewUrl: string) => void;
  onCancel: () => void;
}

export default function AvatarCropModal({ imageSrc, onCropDone, onCancel }: AvatarCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const file = await getCroppedImg(imageSrc, croppedAreaPixels);
    const previewUrl = URL.createObjectURL(file);
    onCropDone(file, previewUrl);
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Recadrer la photo</h3>

        <div className={styles.cropContainer}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className={styles.zoomControl}>
          <span className={styles.zoomLabel}>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className={styles.zoomSlider}
          />
        </div>

        <p className={styles.info}>
          L&apos;image sera convertie en JPEG automatiquement.
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onCancel}>
            Annuler
          </button>
          <button type="button" className={styles.confirmBtn} onClick={handleConfirm}>
            Valider
          </button>
        </div>
      </div>
    </div>
  );
}
