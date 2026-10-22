import "./globals.css";
export const metadata = {
  title: "Trail Club · University Hiking Trip",
  description: "Register for the next university hiking trip.",
};
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
