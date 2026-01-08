"use client";

import Link from "next/link";

import IEBrowser from "@/components/IEBrowser";

function TocLink({ href, children }) {
  return (
    <a href={href} className="text-[#000080] underline hover:text-[#0000FF]">
      {children}
    </a>
  );
}

function SectionTitle({ id, children }) {
  return (
    <h2 id={id} className="text-lg font-bold text-[#000080] scroll-mt-6">
      {children}
    </h2>
  );
}

export default function DocsPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 bg-[#008080]" />

      <div className="absolute inset-0 pb-7 md:pb-7 pb-9">
        <div className="h-full p-2 max-md:p-0">
          <IEBrowser
            title="Documentation"
            url="http://dannydevito.fun/docs"
            iconSrc="/docs-icon.svg"
            faviconSrc="/docs-icon.svg"
          >
            <div className="p-4 font-sans text-sm text-black bg-white max-w-4xl mx-auto">
              <div className="border-b-2 border-[#000080] pb-2 mb-4">
                <div className="flex items-center justify-between gap-3">
                  <h1 className="text-2xl font-bold text-[#000080] flex items-center gap-2">
                    <img src="/docs-icon.svg" alt="" className="h-6 w-6" />
                    Danny DEVito Documentation
                  </h1>
                  <Link
                    href="/"
                    className="px-3 py-1 bg-[#c0c0c0] border-2 text-xs font-bold text-black"
                    style={{ borderColor: "#ffffff #808080 #808080 #ffffff" }}
                  >
                    Back to Desktop
                  </Link>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  A clear overview of how the platform works, what exists today, and what $DEVITO holders receive.
                </p>
              </div>

              <div className="border-2 border-[#808080] mb-4">
                <div className="bg-[#000080] text-white px-3 py-1 font-bold text-sm">Table of Contents</div>
                <div className="bg-white p-3 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <div className="font-bold mb-1">Platform</div>
                      <div className="space-y-1">
                        <div>
                          <TocLink href="#overview">Overview</TocLink>
                        </div>
                        <div>
                          <TocLink href="#agent">Danny DEVito as a self operating agent</TocLink>
                        </div>
                        <div>
                          <TocLink href="#pillars">Core platform pillars</TocLink>
                        </div>
                        <div>
                          <TocLink href="#holder-benefits">$DEVITO holder benefits</TocLink>
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="font-bold mb-1">What is in the repo</div>
                      <div className="space-y-1">
                        <div>
                          <TocLink href="#available-docs">Documents shipped in this codebase</TocLink>
                        </div>
                        <div>
                          <TocLink href="#key-routes">Key routes and endpoints</TocLink>
                        </div>
                        <div>
                          <TocLink href="#configuration">Configuration and environment variables</TocLink>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <SectionTitle id="overview">Overview</SectionTitle>
                  <div className="mt-2 text-xs text-black space-y-2">
                    <p>
                      Danny DEVito is a token driven platform that runs a recurring launch schedule, captures community signal, and
                      turns that signal into new token launches. The platform is intentionally simple to use: connect a wallet,
                      stake $DEVITO if you want allocations, and participate in conversation.
                    </p>
                    <p>
                      The ticker is <strong>$DEVITO</strong>. If you previously saw <strong>$DEV</strong>, that name is being replaced.
                    </p>
                  </div>
                </div>

                <div>
                  <SectionTitle id="agent">Danny DEVito as a self operating agent</SectionTitle>
                  <div className="mt-2 text-xs text-black space-y-2">
                    <p>
                      Danny DEVito is a self operating agent powered by a personality profile and live community inputs.
                      The personality is loaded from a local profile file, and the agent responds in character through chat.
                    </p>
                    <p>
                      The system improves through a feedback loop. Token holders can participate in conversation, those messages are
                      stored, and verified holder messages can influence upcoming launch previews. The platform also supports
                      generating and posting tweets, which keeps the agent active in public channels.
                    </p>
                    <p className="text-gray-700">
                      Implementation notes: the agent logic lives in <span className="font-mono">src/lib/dannyAgent.js</span> and the
                      profile lives in <span className="font-mono">docs/danny_devito_personality.json</span>.
                    </p>
                  </div>
                </div>

                <div>
                  <SectionTitle id="pillars">Core platform pillars</SectionTitle>
                  <div className="mt-2 text-xs text-black space-y-3">
                    <div>
                      <div className="font-bold">1) Vault and launch history</div>
                      <div className="text-gray-800 mt-1">
                        The Vault displays launch history and scheduled launch timing. Launches are stored in the database and
                        rendered in the Vault UI.
                      </div>
                      <div className="text-gray-700 mt-1">
                        Relevant page: <span className="font-mono">src/app/vault/page.js</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold">2) Launch scheduling and previews</div>
                      <div className="text-gray-800 mt-1">
                        The scheduler maintains a persistent cadence, prepares a draft before launch time, and provides a preview
                        window for admins to review or adjust draft fields.
                      </div>
                      <div className="text-gray-700 mt-1">
                        Relevant modules: <span className="font-mono">src/lib/launchScheduler.js</span>,
                        <span className="font-mono"> src/app/api/cron/launch/route.js</span>,
                        <span className="font-mono"> src/app/api/admin/schedule/route.js</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold">3) Pump.fun launch execution</div>
                      <div className="text-gray-800 mt-1">
                        Launches are executed on Solana using the Pump.fun create transaction. The platform signs the transaction
                        through the configured treasury wallet.
                      </div>
                      <div className="text-gray-700 mt-1">
                        Relevant module: <span className="font-mono">src/lib/pumpfun.js</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold">4) Staking and allocations</div>
                      <div className="text-gray-800 mt-1">
                        Staking uses 1:1 escrow wallets per user (server custody via Privy). Allocations accrue per launch and are
                        claimable when the user unstakes. The user pays gas for the claim transactions.
                      </div>
                      <div className="text-gray-700 mt-1">
                        Relevant page and logic: <span className="font-mono">src/app/staking/page.js</span>,
                        <span className="font-mono"> src/lib/staking.js</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold">5) Conversation and holder influence</div>
                      <div className="text-gray-800 mt-1">
                        The agent chat stores conversations. If the sender is a verified holder, their messages can be used as
                        input to launch preview generation.
                      </div>
                      <div className="text-gray-700 mt-1">
                        Relevant endpoints: <span className="font-mono">/api/chat</span>, <span className="font-mono">/chat-logs</span>,
                        and holder verification via <span className="font-mono">src/lib/holderGate.js</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold">6) Twitter and public presence</div>
                      <div className="text-gray-800 mt-1">
                        The platform can generate tweets in character and post them through the X API. This is currently exposed as
                        an admin authenticated endpoint.
                      </div>
                      <div className="text-gray-700 mt-1">
                        Relevant endpoint and module: <span className="font-mono">/api/twitter/tweet</span>,
                        <span className="font-mono"> src/lib/twitter.js</span>
                      </div>
                    </div>

                    <div>
                      <div className="font-bold">7) Admin console</div>
                      <div className="text-gray-800 mt-1">
                        Admins can review schedule drafts, trigger launches, and inspect allocations.
                      </div>
                      <div className="text-gray-700 mt-1">
                        Relevant page: <span className="font-mono">src/app/admin/page.js</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <SectionTitle id="holder-benefits">$DEVITO holder benefits</SectionTitle>
                  <div className="mt-2 text-xs text-black space-y-2">
                    <p>
                      Holding and staking $DEVITO provides access and upside that non stakers do not receive.
                    </p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>
                        <strong>Launch allocations</strong>: stakers receive allocations from new launches. Allocations are weighted
                        by stake and time multiplier.
                      </li>
                      <li>
                        <strong>Claim on unstake</strong>: allocations accrue across launches and are claimed together when you unstake.
                        You pay the network fee, and you receive the accumulated launch tokens.
                      </li>
                      <li>
                        <strong>Influence</strong>: verified holders can have their chat messages used as input to launch preview
                        generation.
                      </li>
                    </ul>
                    <p className="text-gray-700">
                      Tokenomics note: the platform grabs 5% of supply per launch, and 2% of that grab is reserved for stakers.
                    </p>
                  </div>
                </div>

                <div>
                  <SectionTitle id="available-docs">Documents shipped in this codebase</SectionTitle>
                  <div className="mt-2 text-xs text-black space-y-2">
                    <p>The repository includes the following documents and reference files:</p>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#c0c0c0]">
                          <th className="border border-[#808080] px-2 py-1 text-left">Path</th>
                          <th className="border border-[#808080] px-2 py-1 text-left">Purpose</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1 font-mono">docs/STAKING_SETUP.md</td>
                          <td className="border border-[#808080] px-2 py-1">Setup notes for staking, database, and environment variables.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1 font-mono">docs/danny_devito_personality.json</td>
                          <td className="border border-[#808080] px-2 py-1">Primary character profile used to build the agent system prompt.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1 font-mono">docs/personality profile</td>
                          <td className="border border-[#808080] px-2 py-1">A compact written personality reference.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1 font-mono">docs/ai_pumpfun_master_spec.png</td>
                          <td className="border border-[#808080] px-2 py-1">Reference image spec for launch behavior and Pump.fun integration.</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <SectionTitle id="key-routes">Key routes and endpoints</SectionTitle>
                  <div className="mt-2 text-xs text-black">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#c0c0c0]">
                          <th className="border border-[#808080] px-2 py-1 text-left">Area</th>
                          <th className="border border-[#808080] px-2 py-1 text-left">Route</th>
                          <th className="border border-[#808080] px-2 py-1 text-left">Purpose</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1">Vault</td>
                          <td className="border border-[#808080] px-2 py-1 font-mono">/vault</td>
                          <td className="border border-[#808080] px-2 py-1">Launch history and schedule status.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1">Staking</td>
                          <td className="border border-[#808080] px-2 py-1 font-mono">/staking</td>
                          <td className="border border-[#808080] px-2 py-1">Stake, request unstake, claim, and view allocations.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1">Schedule</td>
                          <td className="border border-[#808080] px-2 py-1 font-mono">/api/launch-schedule</td>
                          <td className="border border-[#808080] px-2 py-1">Public schedule countdown and preview timing.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1">Cron launch</td>
                          <td className="border border-[#808080] px-2 py-1 font-mono">/api/cron/launch</td>
                          <td className="border border-[#808080] px-2 py-1">Automated scheduled launch execution.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1">Agent chat</td>
                          <td className="border border-[#808080] px-2 py-1 font-mono">/api/chat</td>
                          <td className="border border-[#808080] px-2 py-1">Chat with the agent. Holder messages can influence launches.</td>
                        </tr>
                        <tr className="hover:bg-[#E8E8FF]">
                          <td className="border border-[#808080] px-2 py-1">Twitter</td>
                          <td className="border border-[#808080] px-2 py-1 font-mono">/api/twitter/tweet</td>
                          <td className="border border-[#808080] px-2 py-1">Generate and post tweets (admin authenticated).</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <SectionTitle id="configuration">Configuration and environment variables</SectionTitle>
                  <div className="mt-2 text-xs text-black space-y-2">
                    <p>
                      Configuration is stored in <span className="font-mono">.env.local</span>. The reference template is
                      <span className="font-mono"> .env.example</span>.
                    </p>
                    <ul className="list-disc ml-4 space-y-1">
                      <li>
                        <strong>Solana RPC</strong>: <span className="font-mono">SOLANA_RPC_URL</span> and
                        <span className="font-mono"> NEXT_PUBLIC_SOLANA_RPC_URL</span>
                      </li>
                      <li>
                        <strong>Treasury wallet</strong>: <span className="font-mono">TREASURY_WALLET_ID</span>
                      </li>
                      <li>
                        <strong>Staking token mint</strong>: <span className="font-mono">DEVITO_TOKEN_MINT</span>
                      </li>
                      <li>
                        <strong>Admin allowlist</strong>: <span className="font-mono">ADMIN_WALLET_PUBKEYS</span>
                      </li>
                      <li>
                        <strong>OpenAI</strong>: <span className="font-mono">OPENAI_API_KEY</span>
                      </li>
                      <li>
                        <strong>X credentials</strong>: variables in the Twitter section of <span className="font-mono">.env.example</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-2 border-t-2 border-[#808080] text-[11px] text-gray-600 text-center">
                Documentation is a work in progress. If you want a section added, specify the title and the intended audience.
              </div>
            </div>
          </IEBrowser>
        </div>
      </div>

      <div className="win-taskbar">
        <Link href="/" className="win-start-btn">
          <img src="/1.png" alt="" className="h-4" />
          <span>Start</span>
        </Link>
        <div className="win-taskbar-items">
          <div className="win-taskbar-item active">
            <span>📄</span>
            <span>Documentation - Internet Explorer</span>
          </div>
        </div>
        <div className="win-taskbar-clock">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
      </div>

      <div className="crt-chromatic" />
      <div className="crt-reflection" />
      <div className="crt-glow" />
      <div className="crt-screen" />
      <div className="crt-overlay" />
    </div>
  );
}
