import Link from "next/link";

export default function EmptyState(props: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="p-4">
      <div className="font-semibold">{props.title}</div>
      {props.description ? (
        <div className="mt-1 text-sm text-muted-foreground">
          {props.description}
        </div>
      ) : null}

      {props.actionHref && props.actionLabel ? (
        <div className="mt-3">
          <Link href={props.actionHref} className="underline">
            {props.actionLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
