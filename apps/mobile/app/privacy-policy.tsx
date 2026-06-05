/**
 * Privacy Policy — Sprint 4.5
 *
 * COPPA + UK GDPR compliant privacy policy screen.
 * Required for App Store and Google Play submission.
 * Accessible from: Welcome screen footer, Settings, App Store listing.
 */
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';

const LAST_UPDATED = '5 June 2026';
const CONTACT_EMAIL = 'privacy@routinestars.app';
const COMPANY = 'RoutineStars Ltd';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2 border-b border-neutral-100">
        <TouchableOpacity onPress={() => router.back()} className="pr-4 py-2" accessibilityRole="button">
          <Text className="font-inter text-brand-primary">← Back</Text>
        </TouchableOpacity>
        <Text className="font-inter font-bold text-neutral-900 text-base">Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="font-inter text-neutral-400 text-xs mb-6">Last updated: {LAST_UPDATED}</Text>

        <Section title="1. Who We Are">
          {`${COMPANY} ("RoutineStars", "we", "us", "our") operates the RoutineStars mobile application. We are registered in England and Wales.\n\nContact: ${CONTACT_EMAIL}`}
        </Section>

        <Section title="2. What Data We Collect">
          {`Parent accounts:\n• Email address and password (via Supabase Auth)\n• Parent PIN (stored as a one-way bcrypt hash — never recoverable)\n• Notification preferences\n• Subscription and billing data (processed by Stripe — we do not store card details)\n\nChild profiles:\n• Child's first name and date of birth\n• Avatar emoji selected by parent\n• Daily routine schedule and activity completion records\n• Stars earned and badges awarded\n• Step-by-step completion timings (seconds per step)\n\nDevice data:\n• Push notification token (for approval alerts)\n• App version and device OS (for crash reporting via Sentry)`}
        </Section>

        <Section title="3. Children's Privacy (COPPA & UK GDPR)">
          {`RoutineStars is designed for use by children aged 4–14 under the direct supervision and control of a parent or guardian.\n\n• Children do not create their own accounts. All child profiles are created and managed by a verified parent.\n• We do not knowingly collect personal data directly from children.\n• No third-party advertising SDKs are present on any child-facing screen.\n• Children cannot interact with any data collection features without parental oversight.\n• Parents can view, edit, or delete all child data at any time from the Settings screen.\n\nIf you believe we have inadvertently collected data from a child without parental consent, contact us at ${CONTACT_EMAIL} and we will delete it within 48 hours.`}
        </Section>

        <Section title="4. Legal Basis for Processing (UK GDPR)">
          {`• Contract performance: account management, schedule delivery, approval flow\n• Legitimate interests: app security, crash reporting, streak calculations\n• Consent (Article 6(1)(a) and Article 22): the optional AI Routine Generator — see Section 8\n• Consent: marketing emails (opt-in only, separate from service emails)\n• Legal obligation: retaining transaction records as required by UK law`}
        </Section>

        <Section title="5. How We Use Your Data">
          {`• Deliver the daily routine scheduling and gamification service\n• Send push notifications to parents when a child requests approval\n• Process subscription payments via Stripe\n• Diagnose crashes and technical errors (Sentry — anonymised)\n• Calculate streaks, badges, and star rewards\n• Generate progress reports for parents`}
        </Section>

        <Section title="6. Data Retention">
          {`• Activity completion records: 90 days, then automatically deleted\n• Annual progress reports: 1 year\n• Account data: retained until account deletion\n• Deleted accounts: all personal data removed within 30 days\n• Stripe billing records: 7 years (legal requirement)`}
        </Section>

        <Section title="7. Data Sharing">
          {`We share data only with:\n• Supabase (database and authentication) — hosted in EU\n• Stripe (payment processing) — PCI DSS Level 1 certified\n• Sentry (crash reporting) — anonymised data only\n• Firebase (push notifications) — device token only\n• Anthropic (AI provider, US) — ONLY when the AI Routine Generator is enabled by the parent. See Section 8.\n\nWe do not sell, rent, or trade any personal data. We do not share child data with any third party beyond what is strictly required to operate the service.`}
        </Section>

        <Section title="8. AI-Assisted Routine Generation (Optional, Off by Default)">
          {`RoutineStars offers an optional AI Routine Generator that drafts an activity routine from a short description you write. The feature is OFF by default. You must explicitly opt in via Settings -> AI Features before any data is sent to the AI provider. You can opt out at any time from the same screen.\n\nProvider:\n• Anthropic, PBC (United States). We have a Data Processing Addendum on file. Anthropic does not train models on data sent via this API.\n\nWhat we send to Anthropic per generation:\n• Your free-text prompt (max 600 characters), with emails and phone numbers removed before transmission\n• Your child's FIRST NAME ONLY (never full name, last name, date of birth, photo, medical history, or any other identifier)\n• An age band (4-6 / 7-10 / 11-14)\n\nWhat we do NOT send to Anthropic:\n• Child's full name, last name, or date of birth\n• Any photos, avatars, or images\n• Any medical, therapeutic, diagnostic, or clinical data\n• Subscription, billing, or payment data\n• Activity completion records or EHCP outcomes\n\nHow the output is handled:\n• Output is returned to your device as a DRAFT only.\n• Nothing is saved or shown to your child unless you review, optionally edit, and explicitly tap Save.\n• Every generation is logged in our ai_generation_log table for audit (described below).\n\nAutomated decision-making (UK GDPR Article 22):\n• The AI does not make decisions about your child. It produces a draft you review.\n• You retain full editorial control. The output is a suggestion, not a determination.\n\nRetention of AI generation data:\n• Prompt text and raw model response: 90 days from generation, then automatically deleted.\n• Metadata (model version, validation outcome, tool called, timestamp): retained for ongoing audit.\n• The audit log is readable only by you (via Subject Access Request) and our service-role operators.\n\nRefusal categories:\nThe AI refuses to generate routines for any request involving advice, diagnosis, medical decisions, safeguarding concerns, off-topic content, or prompt-injection attempts. Refusals are logged with the reason code.\n\nWithdrawing consent:\nTurning off the toggle in Settings stops any further data being sent to Anthropic. To delete your historical generation log, email ${CONTACT_EMAIL} — we will erase the prompt + response fields within 30 days and confirm by email.`}
        </Section>

        <Section title="9. Your Rights (UK GDPR)">
          {`You have the right to:\n• Access: request a copy of all data we hold about you\n• Rectification: correct inaccurate data\n• Erasure: request deletion of your account and all associated data\n• Portability: receive your data in a machine-readable format\n• Restriction: limit how we process your data\n• Objection: object to processing based on legitimate interests\n\nTo exercise any right, email ${CONTACT_EMAIL}. We will respond within 30 days.`}
        </Section>

        <Section title="10. Security">
          {`• All data in transit is encrypted via TLS 1.2+\n• Parent PINs are hashed with bcrypt (cost factor 12) and never stored in plaintext\n• Authentication uses short-lived JWT tokens (15 minutes) stored in device SecureStore\n• Row-level security policies ensure each parent can only access their own data\n• Stripe handles all payment data — we never see card numbers`}
        </Section>

        <Section title="11. Cookies & Analytics">
          {`The mobile app does not use cookies. We do not use Google Analytics or similar tracking tools. Anonymous crash reports are collected via Sentry solely for improving app stability.`}
        </Section>

        <Section title="12. Changes to This Policy">
          {`We will notify you of material changes via the email address on your account at least 14 days before changes take effect. Continued use of the app after that date constitutes acceptance.`}
        </Section>

        <Section title="13. Contact & Complaints">
          {`Email: ${CONTACT_EMAIL}\n\nIf you are unhappy with how we handle your data, you have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk.`}
        </Section>

        <Text className="font-inter text-neutral-400 text-xs text-center mt-8 mb-4">
          © {new Date().getFullYear()} {COMPANY}. All rights reserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View className="mb-6">
      <Text className="font-inter font-bold text-neutral-900 text-sm mb-2">{title}</Text>
      <Text className="font-inter text-neutral-600 text-sm leading-6">{children}</Text>
    </View>
  );
}
