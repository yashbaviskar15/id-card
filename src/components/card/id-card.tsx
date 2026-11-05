import { QrSvg } from '@/components/card/qr-svg';
import { cn } from 'cn';

/** ID-1 proportions: 85.60 x 53.98 mm rendered at a 856 px base width. */
export const CARD_WIDTH_PX = 856;
export const CARD_HEIGHT_PX = 540;

export interface CardData {
  slug: string;
  fullName: string;
  dob: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
}

/** Very faint concentric lines in the lower-right corner. */
function ConcentricLines() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-16 -right-16 h-64 w-64"
      viewBox="0 0 200 200"
      fill="none"
      stroke="#111827"
      strokeOpacity="0.06"
    >
      {[30, 50, 70, 90].map((r) => (
        <circle key={r} cx="100" cy="100" r={r} />
      ))}
    </svg>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-normal tracking-[0.14em] text-label uppercase">{label}</p>
      <p className="mt-1 truncate text-[18px] font-semibold text-ink">{value ?? '—'}</p>
    </div>
  );
}

function Scaled({ scale, children }: { scale: number; children: React.ReactNode }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{ width: CARD_WIDTH_PX * scale, height: CARD_HEIGHT_PX * scale }}
    >
      <div
        className="absolute top-0 left-0"
        style={{
          width: CARD_WIDTH_PX,
          height: CARD_HEIGHT_PX,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function IdCardFront({ data }: { data: CardData }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-hairline bg-white">
      <div className="absolute inset-x-0 top-0 h-2 bg-ink" />
      <div className="flex h-full items-start gap-8 px-12 pt-12 pb-10">
        <div className="flex h-[216px] w-[172px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-subtle-line bg-photo-placeholder">
          {data.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.photoUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-[13px] font-normal tracking-[0.14em] text-label uppercase">Photo</span>
          )}
        </div>

        <div className="min-w-0 flex-1 pt-1">
          <p className="text-[13px] font-normal tracking-[0.2em] text-label uppercase">Identity card</p>
          <h2 className="mt-2 text-[44px] leading-[1.05] font-bold break-words text-ink">
            {data.fullName}
          </h2>
          <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-5">
            <Field label="Date of birth" value={data.dob} />
            <Field label="Phone" value={data.phone} />
            <Field label="Email" value={data.email} />
          </div>
        </div>
      </div>
      <ConcentricLines />
    </div>
  );
}

export function IdCardBack({ data }: { data: CardData }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-hairline bg-white">
      <div className="flex h-full items-center gap-12 px-12 pt-10 pb-12">
        <div className="shrink-0 rounded-2xl border border-subtle-line bg-white p-4 shadow-[0_6px_20px_rgba(17,24,39,0.08)]">
          <QrSvg slug={data.slug} size={280} />
        </div>
        <div className="max-w-[340px]">
          <p className="text-[13px] font-normal tracking-[0.2em] text-label uppercase">Access</p>
          <p className="mt-3 text-[22px] leading-snug font-semibold text-ink">
            Scan, then enter the code I give you.
          </p>
          <p className="mt-3 text-[14px] text-label">
            The code is valid once and for a few minutes only.
          </p>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2 bg-ink" />
      <ConcentricLines />
    </div>
  );
}

export function IdCard({
  face,
  data,
  scale = 1,
  className,
}: {
  face: 'front' | 'back';
  data: CardData;
  scale?: number;
  className?: string;
}) {
  return (
    <Scaled scale={scale}>
      <div className={cn('shadow-[0_10px_30px_rgba(17,24,39,0.10)] rounded-[32px]', className)}>
        {face === 'front' ? <IdCardFront data={data} /> : <IdCardBack data={data} />}
      </div>
    </Scaled>
  );
}
