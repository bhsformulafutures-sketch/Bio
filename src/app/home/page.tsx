"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  AlbumSummaryDTO,
  BoothDTO,
  ChallengeDTO,
  KnowMeRoundDTO,
  PlayerDTO,
  RandomDTO,
  SessionDTO,
  WhereAmIRoundDTO,
} from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { Header } from "@/components/Header";
import {
  Avatar,
  Button,
  Panel,
  Skeleton,
  Spinner,
  Sticker,
  TapeStrip,
  Ticket,
} from "@/components/ui";
import { tiltFor } from "@/lib/tilt";
import { GalleryCard, formatDate } from "@/components/GalleryCard";
import { RandomCard } from "@/components/RandomCard";
import { KnowMeCard } from "@/components/KnowMeCard";
import { WhereAmICard } from "@/components/WhereAmICard";
import { AlbumStrip } from "@/components/AlbumStrip";
import { NotificationToggle } from "@/components/NotificationToggle";
import { toast } from "@/components/Toast";
import { Pressable } from "@/components/motion/Pressable";
import { BlurImage } from "@/components/motion/BlurImage";
import { BoothIcon, MusicIcon } from "@/components/icons";

const POLL_MS = 12_000;

export default function HomePage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionDTO | null>(null);
  const [challenges, setChallenges] = useState<ChallengeDTO[] | null>(null);
  const [randoms, setRandoms] = useState<RandomDTO[] | null>(null);
  const [knowme, setKnowme] = useState<KnowMeRoundDTO[] | null>(null);
  const [whereami, setWhereami] = useState<WhereAmIRoundDTO[] | null>(null);
  const [albums, setAlbums] = useState<AlbumSummaryDTO[] | null>(null);
  const [activeBooth, setActiveBooth] = useState<BoothDTO | null>(null);
  const [booths, setBooths] = useState<BoothDTO[]>([]);
  const [player, setPlayer] = useState<PlayerDTO | null>(null);
  const [starting, setStarting] = useState(false);
  const [startingBooth, setStartingBooth] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [me, list, rand, km, wai, alb, active, boothList, radio] = await Promise.all([
        api.me(),
        api.listChallenges(),
        api.listRandoms(),
        api.listKnowMe(),
        api.listWhereAmI(),
        api.listAlbums(),
        api.activeBooth().catch(() => ({ booth: null })),
        api.listBooths().catch(() => ({ booths: [] })),
        api.getPlayer().catch(() => ({ player: null })),
      ]);
      setSession(me);
      setChallenges(list.challenges);
      setRandoms(rand.randoms);
      setKnowme(km.rounds);
      setWhereami(wai.rounds);
      setAlbums(alb.albums);
      setActiveBooth(active.booth);
      setBooths(boothList.booths);
      setPlayer(radio.player);
    } catch (error) {
      if ((error as { status?: number }).status === 401) router.replace("/");
    }
  }, [router]);

  const startBooth = async () => {
    setStartingBooth(true);
    try {
      const { booth } = await api.startBooth();
      if (booth) router.push(`/booth/${booth.id}`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't start the booth.", "error");
      setStartingBooth(false);
    }
  };

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  if (!session || !challenges || !randoms || !knowme || !whereami || !albums) {
    return (
      <div className="min-h-dvh">
        <Header session={session} />
        <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pt-8">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
          <Skeleton className="h-40" />
        </main>
      </div>
    );
  }

  const yourTurn = challenges.filter((c) => c.status === "waiting" && !c.mine);
  const waitingOnPartner = challenges.filter((c) => c.status === "waiting" && c.mine);
  const memories = challenges.filter((c) => c.status === "completed");
  const openRandom = randoms.find((r) => r.status === "open") ?? null;
  const doneRandoms = randoms.filter((r) => r.status !== "open");
  const openKnowMe = knowme.find((r) => r.status !== "completed") ?? null;
  const doneKnowMe = knowme.filter((r) => r.status === "completed");
  const openWhereAmI = whereami.find((r) => r.status === "waiting") ?? null;
  const doneWhereAmI = whereami.filter((r) => r.status !== "waiting");
  const partnerName = session.partner?.name;
  const totalMoments =
    memories.length + doneRandoms.length + doneKnowMe.length + doneWhereAmI.length;

  const share = async () => {
    const text = `Join me on The Other Half 💞 Room code: ${session.room.code} — ${window.location.origin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast("Invite copied — send it to them!");
      }
    } catch {
      /* user dismissed the share sheet */
    }
  };

  const startRandom = async () => {
    if (openRandom) {
      router.push(`/random/${openRandom.id}`);
      return;
    }
    setStarting(true);
    try {
      const { random } = await api.startRandom();
      router.push(`/random/${random.id}`);
    } catch (error) {
      toast(error instanceof ApiError ? error.message : "Couldn't start a challenge.", "error");
      setStarting(false);
    }
  };

  // Sections enter in a gentle cascade rather than all at once.
  let delayStep = 0;
  const nextDelay = () => `${delayStep++ * 80}ms`;

  return (
    <div className="min-h-dvh pb-16">
      <Header session={session} />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-6">
        <div className="animate-fade-up flex items-center gap-3" style={{ animationDelay: nextDelay() }}>
          <Avatar avatar={session.user.avatar} name={session.user.name} className="size-11 text-xl" />
          <div>
            <h1 className="font-display text-2xl font-bold leading-tight">
              Hi {session.participant.name}
            </h1>
            <p className="text-[15px] text-soft">
              {partnerName
                ? `You & ${partnerName} · ${totalMoments} ${totalMoments === 1 ? "moment" : "moments"} together`
                : "Your room is ready — invite your other half."}
            </p>
          </div>
        </div>

        {!session.partner && (
          <Panel
            className="animate-fade-up relative flex flex-col items-center gap-4 p-6 text-center"
            style={{ animationDelay: nextDelay() }}
          >
            <TapeStrip color="gold" className="-top-3 left-1/2 -translate-x-1/2" />
            <p className="font-hand text-lg text-soft">Share this code with your person</p>
            <p className="font-mono text-4xl font-bold tracking-[0.25em] text-ink">
              {session.room.code}
            </p>
            <Button onClick={share}>Send invite 💌</Button>
          </Panel>
        )}

        {activeBooth && activeBooth.status !== "completed" && (
          <div className="animate-fade-up" style={{ animationDelay: nextDelay() }}>
            <Pressable>
              <Link
                href={`/booth/${activeBooth.id}`}
                className="flex items-center gap-3 rounded-lg border border-accent-deep/50 bg-accent px-4 py-3.5 text-white shadow-lift"
              >
                <BoothIcon className="size-6 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">
                    {activeBooth.mine
                      ? "Your photobooth is waiting"
                      : `${partnerName ?? "Your partner"} started a photobooth`}
                  </span>
                  <span className="block text-xs text-white/80">
                    Tap to jump in — you snap together
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold">Join →</span>
              </Link>
            </Pressable>
          </div>
        )}

        {player && (
          <div className="animate-fade-up" style={{ animationDelay: nextDelay() }}>
            <Pressable>
              <Link
                href="/music"
                className="relative flex items-center gap-3 rounded-lg border border-line bg-[#efe6d2] px-4 py-3 shadow-card"
              >
                <span
                  className="block size-8 shrink-0 animate-[spin_2.2s_linear_infinite] rounded-full"
                  style={{
                    background:
                      "repeating-conic-gradient(#fffdf6 0deg 24deg, #b7a98e 24deg 36deg)",
                  }}
                >
                  <span className="m-auto mt-2.5 block size-3 rounded-full border border-ink/30 bg-[#4a3d33]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-hand text-lg leading-tight text-ink">
                    {player.track.title}
                  </span>
                  <span className="block text-xs text-soft">
                    {player.fromMe ? "Your broadcast" : `${player.startedByName} is on air`} ·{" "}
                    {session.room.code} FM
                  </span>
                </span>
                <Sticker tone="soft" tilt={2} className="shrink-0 uppercase tracking-widest">
                  ● on air
                </Sticker>
              </Link>
            </Pressable>
          </div>
        )}

        <div className="animate-fade-up" style={{ animationDelay: nextDelay() }}>
          <NotificationToggle />
        </div>

        {/* Play together — four game tickets plus the booth strip & the radio */}
        <section className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: nextDelay() }}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Play together</h2>
          <div className="grid grid-cols-2 items-stretch gap-3">
            <GameTicket
              tilt={tiltFor(0)}
              emoji="🎨"
              title="Other Half"
              blurb="Hide half a photo — they imagine the rest."
              tint="bg-accent-soft/50"
              onClick={() => router.push("/new")}
            />
            <GameTicket
              tilt={tiltFor(1)}
              emoji="🎲"
              title={openRandom ? "Continue" : "Random"}
              blurb={openRandom ? "You've got one in progress." : "A surprise prompt. 24 hours. Go!"}
              tint="bg-dusk-soft/60"
              disabled={starting}
              onClick={startRandom}
            />
            <GameTicket
              tilt={tiltFor(2)}
              emoji="📍"
              title={openWhereAmI ? "Continue" : "Where Am I?"}
              blurb={
                openWhereAmI
                  ? "A place is waiting to be found."
                  : "Snap where you are — they guess the spot."
              }
              tint="bg-mint"
              onClick={() =>
                router.push(openWhereAmI ? `/whereami/${openWhereAmI.id}` : "/whereami/new")
              }
            />
            <GameTicket
              tilt={tiltFor(3)}
              emoji="💭"
              title={openKnowMe ? "Continue" : "Know Me"}
              blurb={
                openKnowMe
                  ? "A quiz round is in motion."
                  : "Five questions. How well do they really know you?"
              }
              tint="bg-[#f4e5c6]/70"
              onClick={() => router.push(openKnowMe ? `/knowme/${openKnowMe.id}` : "/knowme")}
            />

            {/* Photobooth — a strip of frames, not a ticket */}
            <Pressable className="h-full">
              <button
                onClick={startBooth}
                disabled={!session.partnerOnline || startingBooth}
                style={{ rotate: `${tiltFor(4)}deg` }}
                className="group flex h-full w-full items-stretch gap-3 border border-line/70 bg-[#fffef9] p-2
                  text-left shadow-card transition-shadow hover:shadow-lift disabled:opacity-60"
              >
                <span className="flex w-10 shrink-0 flex-col gap-1" aria-hidden>
                  <span className="aspect-square w-full bg-kraft/80" />
                  <span className="aspect-square w-full bg-line/80" />
                  <span className="aspect-square w-full bg-kraft/60" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 pr-1">
                  {startingBooth ? (
                    <Spinner className="size-6 text-accent" />
                  ) : (
                    <BoothIcon className="size-6 text-accent" />
                  )}
                  <span className="font-display text-lg leading-tight">Photobooth</span>
                  <span className="text-xs text-soft">
                    {session.partnerOnline
                      ? "Snap a strip together, live."
                      : `${partnerName ?? "Your partner"} needs to be online.`}
                  </span>
                </span>
              </button>
            </Pressable>

            {/* The radio — a little cassette */}
            <Pressable className="h-full">
              <button
                onClick={() => router.push("/music")}
                style={{ rotate: `${tiltFor(5)}deg` }}
                className="group relative flex h-full w-full flex-col justify-between gap-2 rounded-md
                  border border-ink/25 bg-[#4a3d33] p-3 text-left shadow-card transition-shadow hover:shadow-lift"
              >
                {player && (
                  <Sticker tone="soft" tilt={-3} className="absolute -right-2 -top-2 z-10 uppercase tracking-widest">
                    ● on air
                  </Sticker>
                )}
                <span className="block rounded-sm border border-line bg-[#fffef9] px-2 pb-1 pt-0.5">
                  <span className="block truncate font-hand text-base leading-snug text-ink">
                    {session.room.code} FM
                  </span>
                  <span className="block h-px w-full bg-line" />
                </span>
                <span className="flex items-center justify-between rounded-sm bg-ink/30 px-3 py-1.5" aria-hidden>
                  <span className="size-5 rounded-full" style={{ background: "repeating-conic-gradient(#efe6d2 0deg 24deg, #b7a98e 24deg 36deg)" }} />
                  <span className="mx-2 h-0.5 flex-1 rounded-full bg-ink/50" />
                  <span className="size-5 rounded-full" style={{ background: "repeating-conic-gradient(#efe6d2 0deg 24deg, #b7a98e 24deg 36deg)" }} />
                </span>
                <span className="flex items-center gap-1.5 text-xs text-[#efe6d2]">
                  <MusicIcon className="size-4" />
                  {player ? "Someone's playing — come listen." : "The radio · queue up & dedicate."}
                </span>
              </button>
            </Pressable>
          </div>
        </section>

        {(openRandom || openKnowMe || openWhereAmI) && (
          <section className="animate-fade-up" style={{ animationDelay: nextDelay() }}>
            {/* A note pinned to the desk with tape — not another card stack. */}
            <div
              className="relative border border-line/80 shadow-card"
              style={{
                rotate: "-0.5deg",
                backgroundColor: "#fdf9ee",
                backgroundImage: "linear-gradient(rgb(85 103 159 / 0.10) 1px, transparent 1px)",
                backgroundSize: "100% 28px",
              }}
            >
              <TapeStrip color="pink" className="-top-3 left-1/2 -translate-x-1/2" angle={2} />
              <p className="px-4 pt-3 font-hand text-lg text-accent-deep">happening now —</p>
              <div className="flex flex-col divide-y divide-line/60 px-1 pb-2">
                {openRandom && (
                  <NoteRow
                    href={`/random/${openRandom.id}`}
                    emoji="📸"
                    title={openRandom.prompt}
                    detail={
                      openRandom.mineSubmitted
                        ? openRandom.partnerSubmitted
                          ? "You both answered — tap to reveal!"
                          : `Waiting on ${partnerName ?? "your partner"}`
                        : "Your move — snap it before time runs out"
                    }
                  />
                )}
                {openWhereAmI && (
                  <NoteRow
                    href={`/whereami/${openWhereAmI.id}`}
                    emoji="📍"
                    title="Where Am I?"
                    detail={
                      openWhereAmI.mine
                        ? `${partnerName ?? "Your partner"} is hunting for your secret spot`
                        : `Find ${partnerName ?? "your partner"}'s spot — ${openWhereAmI.guessesLeft} ${openWhereAmI.guessesLeft === 1 ? "guess" : "guesses"} left`
                    }
                  />
                )}
                {openKnowMe && (
                  <NoteRow
                    href={`/knowme/${openKnowMe.id}`}
                    emoji="💭"
                    title="Know Me round"
                    detail={
                      openKnowMe.status === "answered"
                        ? "Both sheets are in — tap for the reveal!"
                        : openKnowMe.mineSubmitted
                          ? `Waiting on ${partnerName ?? "your partner"}'s answers`
                          : "Your answer sheet is waiting"
                    }
                  />
                )}
              </div>
            </div>
          </section>
        )}

        {yourTurn.length > 0 && (
          <section className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: nextDelay() }}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Your turn</h2>
            {yourTurn.map((c) => (
              <Pressable key={c.id}>
              <Link
                href={`/challenge/${c.id}`}
                className="group flex items-center gap-4 rounded-lg border border-line bg-surface p-3 shadow-card
                  transition-shadow hover:shadow-lift"
              >
                <BlurImage
                  src={c.visibleUrl}
                  alt=""
                  loading="lazy"
                  wrapperClassName="size-16 shrink-0 rounded-sm border border-line/60"
                  className="h-full w-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{c.creator.name} sent you a challenge</p>
                  <p className="text-sm text-soft">
                    Imagine the missing {c.hiddenSide} · {formatDate(c.createdAt)}
                  </p>
                </div>
                <span className="mr-1 flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent-deep transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </Link>
              </Pressable>
            ))}
          </section>
        )}

        {waitingOnPartner.length > 0 && (
          <section className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: nextDelay() }}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">
              Waiting on {partnerName ?? "your partner"}
            </h2>
            {waitingOnPartner.map((c) => (
              <Link
                key={c.id}
                href={`/challenge/${c.id}`}
                className="flex items-center gap-4 rounded-lg border border-dashed border-line bg-surface/60 p-3
                  transition-colors hover:border-faint"
              >
                <BlurImage
                  src={c.visibleUrl}
                  alt=""
                  loading="lazy"
                  wrapperClassName="size-12 shrink-0 rounded-sm border border-line/60"
                  className="h-full w-full object-cover"
                />
                <p className="text-sm text-soft">
                  Sent {formatDate(c.createdAt)} — they haven&apos;t drawn yet
                </p>
              </Link>
            ))}
          </section>
        )}

        {(totalMoments > 0 || albums.length > 0) && (
          <div className="animate-fade-up" style={{ animationDelay: nextDelay() }}>
            <AlbumStrip albums={albums} onCreated={refresh} />
          </div>
        )}

        {booths.length > 0 && (
          <section className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: nextDelay() }}>
            <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Photobooth</h2>
            <div className="flex gap-4 overflow-x-auto pb-1 pt-3">
              {booths.map(
                (b, i) =>
                  b.stripUrl && (
                    <Link
                      key={b.id}
                      href={`/booth/${b.id}`}
                      className="relative shrink-0 border border-line/70 bg-[#fffef9] p-1 shadow-card
                        transition-transform hover:-translate-y-0.5"
                      style={{ rotate: `${tiltFor(i)}deg` }}
                    >
                      <TapeStrip
                        color={i % 2 ? "mint" : "blue"}
                        className="-top-2.5 left-1/2 h-5 w-12 -translate-x-1/2"
                        angle={i % 2 ? 5 : -4}
                      />
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.stripUrl}
                        alt="Photobooth strip"
                        loading="lazy"
                        className="h-40 w-auto"
                        draggable={false}
                      />
                    </Link>
                  )
              )}
            </div>
          </section>
        )}

        <section className="animate-fade-up flex flex-col gap-3" style={{ animationDelay: nextDelay() }}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-soft">Memories</h2>
          {totalMoments === 0 ? (
            <div className="dotted flex flex-col items-center gap-3 rounded-lg border border-line py-14 text-center">
              <span className="animate-float text-4xl">🌱</span>
              <p className="max-w-60 text-sm text-soft">
                Every finished game blossoms into a memory here. Start one above and plant the first!
              </p>
            </div>
          ) : (
            /* A polaroid wall: masonry columns so heights stay organic. */
            <div className="columns-2 gap-3 md:columns-3">
              {memories.map((c, i) => (
                <div key={c.id} className="mb-3 break-inside-avoid">
                  <GalleryCard challenge={c} index={i} delayMs={Math.min(i, 5) * 60} />
                </div>
              ))}
              {doneRandoms.map((r, i) => (
                <div key={r.id} className="mb-3 break-inside-avoid">
                  <RandomCard
                    random={r}
                    index={memories.length + i}
                    delayMs={Math.min(memories.length + i, 5) * 60}
                  />
                </div>
              ))}
              {doneWhereAmI.map((r, i) => (
                <div key={r.id} className="mb-3 break-inside-avoid">
                  <WhereAmICard
                    round={r}
                    index={memories.length + doneRandoms.length + i}
                    delayMs={Math.min(memories.length + doneRandoms.length + i, 5) * 60}
                  />
                </div>
              ))}
              {doneKnowMe.map((r, i) => (
                <div key={r.id} className="mb-3 break-inside-avoid">
                  <KnowMeCard
                    round={r}
                    partnerName={partnerName}
                    index={memories.length + doneRandoms.length + doneWhereAmI.length + i}
                    delayMs={Math.min(memories.length + doneRandoms.length + doneWhereAmI.length + i, 5) * 60}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/** One line on the "happening now" note. */
function NoteRow({
  href,
  emoji,
  title,
  detail,
}: {
  href: string;
  emoji: string;
  title: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-ink/[0.03]"
    >
      <span className="animate-breathe text-2xl">{emoji}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-ink">{title}</span>
        <span className="block text-sm text-soft">{detail}</span>
      </span>
      <span className="shrink-0 font-hand text-lg text-accent-deep transition-transform group-hover:translate-x-0.5">
        →
      </span>
    </Link>
  );
}

/** One game entry, styled as a punched admission ticket. */
function GameTicket({
  tilt,
  emoji,
  title,
  blurb,
  tint,
  onClick,
  disabled = false,
}: {
  tilt: number;
  emoji: string;
  title: string;
  blurb: string;
  tint: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Ticket tilt={tilt} className="h-full">
      <button
        onClick={onClick}
        disabled={disabled}
        className={`group flex h-full w-full flex-col items-start gap-1.5 rounded-lg p-4 text-left
          disabled:opacity-60 ${tint}`}
      >
        <span className="text-3xl transition-transform group-hover:scale-110">{emoji}</span>
        <span className="font-display text-lg leading-tight">{title}</span>
        <span className="text-xs text-soft">{blurb}</span>
        <span className="mt-auto pt-1 font-hand text-[13px] text-faint">✂ admit two</span>
      </button>
    </Ticket>
  );
}
