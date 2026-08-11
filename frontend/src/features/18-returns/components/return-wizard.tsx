"use client";

import { ArrowLeft, ArrowRight, Check, ImagePlus } from "lucide-react";
import { useState } from "react";

import { AccountSection } from "@/components/account/account-section";

const steps = ["Items", "Quantity", "Reason", "Outcome", "Pickup", "Review"];

export function ReturnWizard() {
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState(false);

  if (complete) return <AccountSection eyebrow="Return preview / No mutation sent" title="Request ready." copy="The return details are staged locally. No order, pickup, refund, or inventory state was changed."><div className="account-notice account-notice--large"><Check size={22} /><p><strong>Frontend journey completed</strong><small>The future API will recheck eligibility, create the return idempotently, and return its canonical timeline.</small></p></div></AccountSection>;

  return <AccountSection eyebrow="Returns / New request" title="Start a return." copy="Eligibility and values shown here remain illustrative until the returns API is connected.">
    <ol className="return-progress" aria-label="Return progress">{steps.map((label, index) => <li className={index === step ? "is-current" : index < step ? "is-complete" : ""} key={label}><span>{index < step ? <Check size={13} /> : index + 1}</span><small>{label}</small></li>)}</ol>
    <section className="return-step-card">
      {step === 0 && <fieldset><legend>Eligible items</legend><label className="return-option"><input type="checkbox" defaultChecked /><span><strong>Bone Utility Overshirt</strong><small>Bone / L · IO-2026-1027 · delivered 18 Jul</small></span><b>₹11,400</b></label></fieldset>}
      {step === 1 && <fieldset><legend>Quantity</legend><label className="return-field">Return quantity<select defaultValue="1"><option value="1">1 of 1</option></select></label></fieldset>}
      {step === 2 && <fieldset><legend>Reason and evidence</legend><div className="return-option-grid"><label className="return-option"><input type="radio" name="reason" defaultChecked /><span><strong>Size or fit</strong><small>Too small, too large, or fit differs</small></span></label><label className="return-option"><input type="radio" name="reason" /><span><strong>Quality concern</strong><small>Photos will be required</small></span></label><label className="return-option"><input type="radio" name="reason" /><span><strong>Changed my mind</strong><small>Item must remain unworn</small></span></label></div><label className="return-upload"><ImagePlus size={20} /><span><strong>Add evidence</strong><small>Up to five JPG, PNG, or WebP images</small></span><input type="file" accept="image/jpeg,image/png,image/webp" multiple /></label></fieldset>}
      {step === 3 && <fieldset><legend>Choose an outcome</legend><div className="return-option-grid"><label className="return-option"><input type="radio" name="outcome" defaultChecked /><span><strong>Refund · ₹11,400</strong><small>Original Visa ending 1182 · after QC</small></span></label><label className="return-option"><input type="radio" name="outcome" /><span><strong>Exchange</strong><small>Replacement stock rechecked on submit</small></span></label><label className="return-option"><input type="radio" name="outcome" /><span><strong>Store credit · ₹11,400</strong><small>Available after QC approval</small></span></label></div></fieldset>}
      {step === 4 && <fieldset><legend>Reverse pickup</legend><label className="return-option"><input type="radio" name="pickup" defaultChecked /><span><strong>07 Aug · 10:00–14:00</strong><small>Saved address · New Delhi, Delhi</small></span></label><label className="return-option"><input type="radio" name="pickup" /><span><strong>08 Aug · 14:00–18:00</strong><small>Saved address · New Delhi, Delhi</small></span></label></fieldset>}
      {step === 5 && <div className="return-review"><div><span>Item</span><strong>Bone Utility Overshirt · Bone / L</strong></div><div><span>Reason</span><strong>Size or fit</strong></div><div><span>Outcome</span><strong>Refund · ₹11,400</strong></div><div><span>Pickup</span><strong>07 Aug · 10:00–14:00</strong></div><p>The server will revalidate eligibility, stock, amount, pickup serviceability, and idempotency before submission.</p></div>}
      <div className="return-step-actions"><button className="button button--secondary" type="button" disabled={step === 0} onClick={() => setStep((value) => Math.max(0, value - 1))}><ArrowLeft size={16} /> Back</button><button className="button button--primary" type="button" onClick={() => step === steps.length - 1 ? setComplete(true) : setStep((value) => value + 1)}>{step === steps.length - 1 ? "Prepare request" : "Continue"}<ArrowRight size={16} /></button></div>
    </section>
  </AccountSection>;
}
