import type { ComponentProps } from 'react';

export default function Footer({ children }: ComponentProps<'footer'>) {
  return <footer>{children}</footer>;
}
