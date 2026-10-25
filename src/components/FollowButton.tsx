import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { followsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type { FollowableType } from "../types/follow";

interface FollowButtonProps {
  /** Which detail page this button sits on. */
  kind: FollowableType
  /** The target's slug (preferred) or numeric id. */
  identifier: string | number | null | undefined
  className?: string
}

/**
 * Follow/unfollow toggle for Producer, Wine, Review and Article detail pages
 * (issue #192). Anonymous users are prompted to sign in. State comes from
 * `GET /follows/status` (server truth) and every change is confirmed by the
 * API response — no local +1/-1 guessing.
 */
export default function FollowButton({ kind, identifier, className = "" }: FollowButtonProps) {
  const { isAuthenticated } = useAuth();
  const [following, setFollowing] = useState(false);
  const [followId, setFollowId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  const identifierKey = identifier == null ? null : String(identifier);

  useEffect(() => {
    if (!isAuthenticated || identifierKey == null) return;

    let cancelled = false;
    followsApi
      .status(kind, identifierKey)
      .then((state) => {
        if (cancelled) return;
        setFollowing(state.following);
        setFollowId(state.follow_id);
        setResolved(true);
      })
      .catch(() => {
        // Status failures (network, expiry) leave the button usable: a follow
        // attempt will surface a real error then.
        setResolved(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, identifierKey, isAuthenticated]);

  const toggle = useCallback(async () => {
    if (pending || identifierKey == null) return;
    setPending(true);
    setError(null);
    try {
      if (following && followId != null) {
        await followsApi.unfollow(followId);
        setFollowing(false);
        setFollowId(null);
      } else {
        const follow = await followsApi.follow(
          typeof identifier === "number" || /^\d+$/.test(identifierKey)
            ? { followable_type: kind, followable_id: identifierKey }
            : { followable_type: kind, followable_slug: identifierKey },
        );
        setFollowing(true);
        setFollowId(follow.id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update follow");
    } finally {
      setPending(false);
    }
  }, [following, followId, identifier, identifierKey, kind, pending]);

  if (!isAuthenticated) {
    return (
      <Link
        to="/login"
        className={`follow-button follow-button--readonly ${className}`.trim()}
        title="Sign in to follow"
        aria-label="Sign in to follow"
      >
        ☆ Follow
      </Link>
    );
  }

  return (
    <span className="follow-button__wrap">
      <button
        type="button"
        className={`follow-button${following ? " follow-button--following" : ""} ${className}`.trim()}
        onClick={(e) => {
          e.stopPropagation();
          void toggle();
        }}
        disabled={pending || (identifierKey == null && !resolved)}
        aria-pressed={following}
        aria-label={following ? "Following" : "Follow"}
        title={following ? "Unfollow" : "Follow"}
      >
        <span aria-hidden="true">{following ? "★" : "☆"}</span>{" "}
        {following ? "Following" : "Follow"}
      </button>
      {error && (
        <span className="follow-button__error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}