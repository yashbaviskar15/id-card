import { notFound } from "next/navigation";
import { getVisitorProfile } from "@/lib/visitor-profile";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { robots: { index: false, follow: false } };
}

export default async function PublicProfileGate({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[A-Za-z0-9_-]{12,}$/.test(slug)) notFound();
  const profile = await getVisitorProfile(slug);

  if (profile) {
    return (
      <main className="lock-page">
        <section className="lock-panel" aria-labelledby="profile-title">
          <div className="lock-mark">Private profile</div>
          <h1 id="profile-title">{profile.fullName}</h1>
          {profile.emails.map((email) => <p key={`${email.label}-${email.value}`}><a href={`mailto:${email.value}`}>{email.value}</a></p>)}
          {profile.phones.map((phone) => <p key={`${phone.label}-${phone.value}`}><a href={`tel:${phone.value}`}>{phone.value}</a></p>)}
          {profile.dob && <p>Date of birth: {profile.dob}</p>}
          {profile.address && <p>{profile.address}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="lock-page">
      <section className="lock-panel" aria-labelledby="lock-title">
        <div className="lock-mark">Private access</div>
        <h1 id="lock-title">Enter access code</h1>
        <p>Enter the access code from the owner.</p>
        <form className="code-form" action={`/p/${slug}/unlock`} method="post">
          <label htmlFor="access-code">One-time code</label>
          <input
            className="code-input"
            id="access-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{8}"
            maxLength={8}
            required
          />
          <button className="code-button" type="submit">Unlock</button>
        </form>
      </section>
    </main>
  );
}