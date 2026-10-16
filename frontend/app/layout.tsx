import { WalletProvider } from '@/components/wallet-provider';
import { WalletPanel } from '@/components/wallet-panel';
import type { Metadata } from 'next';
import {siteUrl} from '@/lib/site-metadata';
import './globals.css';
import './event.css';
import { CafeProvider } from '@/components/cafe-provider';
import { LanguageProvider } from '@/components/language-provider';
import { Shell } from '@/components/shell';
const title = 'Stellar Chill Café — A little coffee. A little cosmos.';
const description = 'Brew something. Put it on-chain. Share a little joy. Create café recipes and discover the community on Stellar Testnet.';
export const metadata: Metadata = {
  metadataBase:siteUrl(), title, description, applicationName:'Stellar Chill Café',
  openGraph:{title:'Stellar Chill Café',description,siteName:'Stellar Chill Café',type:'website',locale:'en_US'},
  twitter:{card:'summary_large_image',title:'Stellar Chill Café',description,images:[{url:'/opengraph-image',alt:'Stellar Chill Café — coffee, community and a little cosmos.'}]},
};
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="en"><body><LanguageProvider><WalletProvider><CafeProvider><Shell>{children}</Shell><WalletPanel /></CafeProvider></WalletProvider></LanguageProvider></body></html>; }
