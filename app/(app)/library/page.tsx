// Library was renamed to Documents — keep old links working.
import { redirect } from 'next/navigation';

export default function LibraryRedirect() {
  redirect('/documents');
}
