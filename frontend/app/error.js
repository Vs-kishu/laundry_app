"use client";

export default function Error({ reset }) {
  return (
    <div className="container-x grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <h1 className="text-3xl font-extrabold">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">An unexpected error occurred. Please try again.</p>
        <button onClick={reset} className="btn btn-primary mt-6">Try again</button>
      </div>
    </div>
  );
}
