import Link from "next/link";

export default function PageHeader(props: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">{props.title}</h1>
        {props.subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{props.subtitle}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {props.right ? (
          props.right
        ) : (
          <Link
            href="/dashboard"
            className="rounded-lg border px-3 py-2 text-sm"
          >
            Back to Dashboard
          </Link>
        )}
      </div>
    </div>
  );
}
