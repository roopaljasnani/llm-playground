export function PayloadPreview({
  payload,
  comparePayload,
}: {
  payload: Record<string, unknown>;
  comparePayload?: Record<string, unknown>;
}) {
  return (
    <details className="payload">
      <summary>Request payload</summary>
      <pre>
        <code>{JSON.stringify(payload, null, 2)}</code>
      </pre>
      {comparePayload ? (
        <>
          <p className="payload__label">Compare model</p>
          <pre>
            <code>{JSON.stringify(comparePayload, null, 2)}</code>
          </pre>
        </>
      ) : null}
    </details>
  );
}
