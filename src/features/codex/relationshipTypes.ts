/**
 * Sumber tunggal untuk tipe relasi Codex.
 *
 * `value` disimpan di DB (tabel `relationships`). `label` adalah teks yang
 * ditampilkan dari sisi sumber relasi, `inverse` dari sisi target. Untuk relasi
 * berarah (mis. "Memiliki"), label dari sisi target harus dibalik agar tidak
 * salah baca ("Dimiliki oleh") — itulah inti perbaikan label relasi berarah.
 */
export interface RelationshipTypeDef {
  value: string;
  label: string;
  inverse: string;
}

export const RELATIONSHIP_TYPES: RelationshipTypeDef[] = [
  { value: 'Friend',     label: 'Teman',      inverse: 'Teman' },
  { value: 'Enemy',      label: 'Musuh',      inverse: 'Musuh' },
  { value: 'Family',     label: 'Keluarga',   inverse: 'Keluarga' },
  { value: 'Lover',      label: 'Kekasih',    inverse: 'Kekasih' },
  { value: 'Ally',       label: 'Sekutu',     inverse: 'Sekutu' },
  { value: 'Resides In', label: 'Tinggal di', inverse: 'Dihuni oleh' },
  { value: 'Owns',       label: 'Memiliki',   inverse: 'Dimiliki oleh' },
  { value: 'Other',      label: 'Lainnya',    inverse: 'Lainnya' },
];

const TYPE_MAP = new Map(RELATIONSHIP_TYPES.map(t => [t.value, t]));

/**
 * Mengembalikan label relasi yang sesuai arah. `isSource=false` (entri adalah
 * target) memakai bentuk invers. Tipe lama/kustom yang tak dikenal ditampilkan
 * apa adanya agar tidak ada relasi yang hilang labelnya.
 */
export function getRelationshipLabel(type: string, isSource: boolean): string {
  const def = TYPE_MAP.get(type);
  if (!def) return type;
  return isSource ? def.label : def.inverse;
}
