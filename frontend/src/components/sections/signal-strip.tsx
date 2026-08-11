const messages = [
  "320 units only",
  "Heavyweight construction",
  "India-wide delivery",
  "Designed after dark",
];

export function SignalStrip() {
  return (
    <div className="signal-strip" aria-label="Collection details">
      <div className="signal-strip__track">
        {[...messages, ...messages].map((message, index) => (
          <span key={`${message}-${index}`}>
            {message}
            <i aria-hidden="true" />
          </span>
        ))}
      </div>
    </div>
  );
}
