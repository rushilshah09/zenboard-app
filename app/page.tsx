import { redirect } from 'next/navigation';

// Root → the app. The proxy sends unauthenticated visitors to /login.
export default function Home() {
  redirect('/today');
}
