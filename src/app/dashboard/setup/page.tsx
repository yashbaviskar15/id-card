import { createProfile } from "../actions";

export default function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <SetupForm searchParams={searchParams} />;
}

async function SetupForm({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <>
      <h2>Create profile</h2>
      <p className="dashboard-muted">This creates the profile and its permanent random QR slug. Later information updates never change that slug.</p>
      <form className="code-form" action={createProfile}>
        <label htmlFor="full-name">Name</label>
        <input className="code-input" id="full-name" name="fullName" maxLength={120} required />
        <button className="code-button" type="submit">Create profile</button>
        {error && <p role="alert">Unable to create the profile. It may already exist.</p>}
      </form>
    </>
  );
}