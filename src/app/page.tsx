export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>Freshware</h1>
      <p>Choose an option:</p>
      <ul>
        <li><a href="/signup">Sign up</a></li>
        <li><a href="/login">Log in</a></li>
        <li><a href="/dashboard">Dashboard</a></li>
      </ul>
    </main>
  );
}
