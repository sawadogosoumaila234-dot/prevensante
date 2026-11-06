import { useRef, useState } from 'react';
import { Alert } from './Alert';
import { compressPhoto, type CompressedPhoto } from '../lib/photo';

export interface PhotoUploaderProps {
  photos: CompressedPhoto[];
  onChange: (photos: CompressedPhoto[]) => void;
  label?: string;
  max?: number;
}

/**
 * Televersement de photos (section 13.3) : compression 1600 px / 70 %,
 * apercu, suppression, etat de progression.
 */
export function PhotoUploader({
  photos,
  onChange,
  label = 'Add photo',
  max = 6,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError('');
    setBusy(true);
    try {
      const next = [...photos];
      for (const file of Array.from(files)) {
        if (next.length >= max) break;
        try {
          next.push(await compressPhoto(file));
        } catch {
          setError('This image could not be processed.');
        }
      }
      onChange(next);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = (id: string) => onChange(photos.filter((p) => p.id !== id));

  return (
    <div>
      <input
        ref={inputRef}
        id="photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="visually-hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <label className="photo-zone" htmlFor="photo-input" style={{ display: 'block' }}>
        <span aria-hidden="true" style={{ fontSize: 28 }}>
          ⬚
        </span>
        <p style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{label}</p>
        <p className="small">
          {busy ? 'Compressing…' : 'Photos are compressed to 1600 px / 70 % quality (webp, then jpeg).'}
        </p>
      </label>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {photos.length > 0 ? (
        <ul className="photo-grid" style={{ listStyle: 'none', padding: 0 }}>
          {photos.map((photo) => (
            <li className="photo-item" key={photo.id}>
              <img src={photo.dataUrl} alt={photo.name} loading="lazy" decoding="async" />
              <div className="photo-actions">
                <button type="button" onClick={() => remove(photo.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {photos.length >= max ? (
        <p className="small muted">The maximum number of photos has been reached.</p>
      ) : null}
    </div>
  );
}
