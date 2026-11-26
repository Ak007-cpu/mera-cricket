import React from 'react';
import { ThemeToggleButton } from '../Common/ThemeToggleButton';
import { ArrowLeft, ShieldCheck, FileText, Mail, Cookie, Globe } from 'lucide-react';

export type LegalPageType = 'privacy' | 'terms' | 'contact';

interface LegalPagesProps {
  page: LegalPageType;
  siteName?: string;
  contactEmail?: string;
  onNavigatePage: (page: LegalPageType | null) => void;
}

export const LegalPages: React.FC<LegalPagesProps> = ({
  page,
  siteName = 'Live Cricket HD',
  contactEmail = 'contact@livecrickethd.com',
  onNavigatePage
}) => {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-gradient-to-b dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 text-slate-950 dark:text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-slate-300 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => onNavigatePage(null)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Live Broadcast</span>
          </button>

          <nav className="flex items-center gap-1.5 text-xs flex-wrap">
            <button
              onClick={() => onNavigatePage('privacy')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                page === 'privacy'
                  ? 'bg-slate-900 text-white border border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Privacy Policy
            </button>
            <button
              onClick={() => onNavigatePage('terms')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                page === 'terms'
                  ? 'bg-slate-900 text-white border border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Terms
            </button>
            <button
              onClick={() => onNavigatePage('contact')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                page === 'contact'
                  ? 'bg-slate-900 text-white border border-slate-900 dark:bg-slate-800 dark:border-slate-700'
                  : 'text-slate-700 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Contact
            </button>
            <ThemeToggleButton variant="broadcast" />
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {page === 'privacy' && (
          <article className="bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md dark:shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                  Privacy Policy
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                  {siteName} • Effective Date: {new Date().getFullYear()}
                </p>
              </div>
            </div>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>
                At <strong>{siteName}</strong>, accessible from this website, one of our main priorities is the privacy of our visitors. This Privacy Policy document outlines the types of information that are collected and recorded by {siteName} and how we use it.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white flex items-center gap-2">
                <Cookie className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Cookies &amp; Google AdSense</span>
              </h2>
              <p>
                We use Google AdSense and third-party advertising partners to display advertisements on our public broadcast pages. Third-party vendors, including Google, use cookies (such as the DoubleClick DART cookie) to serve ads based on a user&apos;s prior visits to this website or other websites on the internet.
              </p>
              <p>
                Google&apos;s use of advertising cookies enables it and its partners to serve ads to our users based on their visit to {siteName} and/or other sites on the Internet. Users may opt out of personalized advertising by visiting{' '}
                <a
                  href="https://adssettings.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 dark:text-blue-400 underline hover:text-blue-900 dark:hover:text-blue-300"
                >
                  Google Ads Settings
                </a>
                , or by visiting{' '}
                <a
                  href="https://www.aboutads.info/choices/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 dark:text-blue-400 underline hover:text-blue-900 dark:hover:text-blue-300"
                >
                  aboutads.info
                </a>
                .
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">Log Files &amp; Technical Data</h2>
              <p>
                {siteName} follows a standard procedure of using server log files for security and uptime monitoring. These files may record standard technical information such as IP addresses, browser type, Internet Service Provider (ISP), date/time stamps, and referring pages. This data is not linked to any personally identifiable information.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">Third-Party Sponsors &amp; External Links</h2>
              <p>
                Our broadcast page may display featured sponsor banners and links to partner websites. {siteName} has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party sites or advertising networks. We advise you to consult the respective Privacy Policies of those third-party services.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">Consent &amp; Children&apos;s Information</h2>
              <p>
                By using our website, you hereby consent to our Privacy Policy and agree to its terms. {siteName} does not knowingly collect any Personal Identifiable Information from children under the age of 13.
              </p>
            </section>

            <section className="bg-slate-100 dark:bg-slate-950/70 border border-slate-300 dark:border-slate-800 rounded-2xl p-4 text-xs text-slate-700 dark:text-slate-300 space-y-1">
              <div className="font-bold text-slate-950 dark:text-white">Questions about this Privacy Policy?</div>
              <p>
                Contact us at{' '}
                <a href={`mailto:${contactEmail}`} className="text-blue-700 dark:text-blue-400 underline">
                  {contactEmail}
                </a>
              </p>
            </section>
          </article>
        )}

        {page === 'terms' && (
          <article className="bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md dark:shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                  Terms of Service
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                  {siteName} • Terms &amp; Conditions
                </p>
              </div>
            </div>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing and viewing {siteName}, you agree to be bound by these Terms of Service and all applicable laws and regulations.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">2. Live Score &amp; Match Information</h2>
              <p>
                Live cricket scores, run-rate progression graphics, and match statistics are provided for informational and entertainment purposes only. While we strive for real-time accuracy, occasional transmission delays or feed discrepancies may occur.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">3. Advertisements &amp; Sponsored Content</h2>
              <p>
                Public broadcast pages include third-party advertisements and sponsor banners. {siteName} does not endorse or guarantee products or services advertised by third-party networks or sponsors.
              </p>
            </section>

            <section className="space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <h2 className="text-base font-bold text-slate-950 dark:text-white">4. Acceptable Use</h2>
              <p>
                You agree not to attempt unauthorized access to administrative endpoints, disrupt live synchronization streams, or scrape/republish broadcast feeds without permission.
              </p>
            </section>
          </article>
        )}

        {page === 'contact' && (
          <article className="bg-white dark:bg-slate-900/80 border border-slate-300 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-md dark:shadow-2xl space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white tracking-tight">
                  Contact Us
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-mono mt-0.5">
                  {siteName} • Support &amp; Sponsorship Inquiries
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              Have a question about live match coverage, privacy, advertising, or broadcast sponsorship opportunities on {siteName}? Reach out directly using the details below.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                  <Mail className="w-4 h-4" />
                  <span>Direct Email</span>
                </div>
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-base font-bold text-slate-950 dark:text-white hover:text-blue-700 dark:hover:text-blue-400 transition-colors break-all block"
                >
                  {contactEmail}
                </a>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  For general support, DMCA/copyright notices, and privacy requests.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-2xl p-5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  <Globe className="w-4 h-4" />
                  <span>Sponsorship &amp; Advertising</span>
                </div>
                <div className="text-base font-bold text-slate-950 dark:text-white">
                  Broadcast Partnerships
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Interested in featuring your brand on our live scoreboard sponsor banner? Email{' '}
                  <a href={`mailto:${contactEmail}`} className="text-amber-700 dark:text-amber-400 underline">
                    {contactEmail}
                  </a>
                  .
                </p>
              </div>
            </div>
          </article>
        )}
      </main>
    </div>
  );
};
