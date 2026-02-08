export default function TableToolbar(props: {
  left: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">{props.left}</div>
      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}
