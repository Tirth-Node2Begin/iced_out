"use client";

import { ArrowRight, Check } from "lucide-react";
import { useState, type FormEvent } from "react";

export function NewsletterForm() {
  const [isSubmitted, setSubmitted] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) setSubmitted(true);
  }

  if (isSubmitted) {
    return (
      <div className="newsletter-success" role="status">
        <Check aria-hidden="true" size={18} />
        You&apos;re on the list. Watch your inbox.
      </div>
    );
  }

  return (
    <form
      className="newsletter-form"
      onSubmit={submit}
    >
      <div className="newsletter-form__field">
        <label className="sr-only" htmlFor="newsletter-email">
          Email address
        </label>
        <input
          id="newsletter-email"
          type="email"
          placeholder="EMAIL ADDRESS"
          name="email"
          required
        />
        <button aria-label="Join the private list" type="submit">
          Join the list
          <ArrowRight aria-hidden="true" size={16} />
        </button>
      </div>
    </form>
  );
}
