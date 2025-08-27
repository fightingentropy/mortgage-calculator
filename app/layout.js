import './globals.css';

export const metadata = {
  title: 'UK Property Net Yield Calculator',
  description: 'After expenses, mortgage and income tax (Section 24 aware)'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}


