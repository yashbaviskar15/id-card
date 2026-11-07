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
      <p className="text-[12px] font-black tracking-[0.2em] text-label/40 uppercase leading-none">{label}</p>
      <p className="mt-2 truncate text-[20px] font-black text-ink tracking-tight">{value ?? '—'}</p>
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
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-hairline bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
      <div className="absolute inset-x-0 top-0 h-2.5 bg-ink" />
      <div className="flex h-full items-start gap-10 px-12 pt-14 pb-10">
        <div className="relative group shrink-0">
          <div className="flex h-[220px] w-[180px] items-center justify-center overflow-hidden rounded-2xl border-2 border-subtle-line bg-photo-placeholder shadow-md transition-all group-hover:scale-[1.02] group-hover:shadow-lg">
            {data.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.photoUrl}
                alt=""
                className="h-full w-full object-contain"
                referrerPolicy="no-referrer"
                loading="eager"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 opacity-30">
                <div className="h-12 w-12 rounded-full border-2 border-label flex items-center justify-center">
                   <div className="h-6 w-6 rounded-full bg-label" />
                </div>
                <span className="text-[12px] font-black tracking-[0.2em] text-label uppercase">No Photo</span>
              </div>
            )}
          </div>
          <div className="absolute -inset-1 rounded-2xl border border-ink/5 pointer-events-none" />
        </div>

        <div className="min-w-0 flex-1 pt-2">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-ink/20 animate-pulse" />
            <p className="text-[12px] font-black tracking-[0.25em] text-label/60 uppercase">Identity card</p>
          </div>
          <h2 className="mt-4 text-[44px] leading-[1.1] font-black tracking-tight text-ink drop-shadow-sm break-words max-h-[100px] overflow-hidden">
            {data.fullName}
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-x-10 gap-y-6">
            <Field label="Date of birth" value={data.dob} />
            <Field label="Phone" value={data.phone} />
            <div className="col-span-2">
              <Field label="Email" value={data.email} />
            </div>
          </div>
        </div>
      </div>
      <ConcentricLines />
      <div className="absolute bottom-8 right-12 opacity-10">
        <div className="h-12 w-12 rounded-full border-[3px] border-ink" />
      </div>
    </div>
  );
}

export function IdCardBack({ data }: { data: CardData }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[32px] border border-hairline bg-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
      <div className="flex h-full items-center gap-16 px-16 pt-10 pb-12">
        <div className="shrink-0 group relative">
          <div className="rounded-3xl border-2 border-subtle-line bg-white p-6 shadow-[0_15px_40px_rgba(17,24,39,0.1)] transition-all group-hover:scale-[1.02] group-hover:shadow-[0_20px_50px_rgba(17,24,39,0.15)]">
            <QrSvg slug={data.slug} size={280} />
          </div>
          <div className="absolute -inset-2 rounded-[40px] border border-ink/5 pointer-events-none" />
        </div>
        <div className="max-w-[340px] space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-ink/20 animate-pulse" />
              <p className="text-[12px] font-black tracking-[0.25em] text-label/60 uppercase">Security</p>
            </div>
            <p className="mt-5 text-[28px] leading-[1.2] font-black text-ink tracking-tight">
              Scan to verify identity securely.
            </p>
          </div>
          <p className="text-[16px] font-medium leading-relaxed text-label/70">
            The generated access code is valid for one-time use and expires quickly.
          </p>
          <div className="pt-4">
            <div className="h-1.5 w-16 rounded-full bg-ink/10" />
          </div>
        </div>
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2.5 bg-ink" />
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
