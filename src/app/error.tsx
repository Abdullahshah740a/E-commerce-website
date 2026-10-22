'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty container">
      <h1>We couldn’t load this page.</h1>
      <p>Please try again in a moment. Your shopping bag is still saved on this device.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
