'use client';

import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-[#161513] flex items-center justify-center px-4 antialiased selection:bg-emerald-500/30">
      <SignUp
        appearance={{
          baseTheme: undefined,
          elements: {
            rootBox: 'mx-auto shadow-2xl rounded-xl',
            card: 'bg-[#211f1c] shadow-2xl border border-[#2d2b27] p-2',
            headerTitle: 'text-white font-black tracking-tight',
            headerSubtitle: 'text-[#bababa] text-xs font-sans',
            socialButtonsBlockButton:
              'bg-[#161513] border border-[#2d2b27] text-[#e4e4e4] hover:bg-[#262421] hover:border-[#3c3934] transition-all duration-150',
            socialButtonsBlockButtonText: 'text-[#e4e4e4] font-semibold',
            dividerLine: 'bg-[#2d2b27]',
            dividerText: 'text-[#615e59] font-mono text-xs uppercase',
            formFieldLabel: 'text-[#bababa] text-xs font-bold uppercase tracking-wider',
            formFieldInput:
              'bg-[#161513] border-[#2d2b27] text-[#e4e4e4] placeholder:text-[#615e59] focus:border-emerald-500 transition-colors rounded-md h-10',
            formButtonPrimary:
              'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md py-2.5',
            footerActionLink: 'text-emerald-400 hover:text-emerald-300 transition-colors font-bold',
            footerActionText: 'text-[#bababa] font-medium',
            identityPreviewText: 'text-[#e4e4e4] font-mono',
            identityPreviewEditButton: 'text-emerald-400 hover:text-emerald-300 font-bold',
          },
        }}
      />
    </div>
  );
}
