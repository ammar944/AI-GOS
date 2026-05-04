import type { ReactElement, ReactNode } from "react";
import {
  AgentInvocationBlock,
  type AgentInvocation,
  type AgentInvocationStatus,
} from "@/components/gtm/AgentInvocationBlock";
import { cn } from "@/lib/utils";

type ChatMessageVariant = "user" | "agent-text" | "agent-block";

interface BaseChatMessageProps {
  className?: string;
}

interface UserChatMessageProps extends BaseChatMessageProps {
  variant: "user";
  children: ReactNode;
}

interface AgentTextChatMessageProps extends BaseChatMessageProps {
  variant: "agent-text";
  children: ReactNode;
}

interface AgentBlockChatMessageProps extends BaseChatMessageProps {
  variant: "agent-block";
  invocation: AgentInvocation;
  status: AgentInvocationStatus;
}

export type ChatMessageProps =
  | UserChatMessageProps
  | AgentTextChatMessageProps
  | AgentBlockChatMessageProps;

export function ChatMessage(props: ChatMessageProps): ReactElement {
  if (props.variant === "user") {
    return (
      <div
        data-variant="user"
        className={cn("flex justify-end gap-3", props.className)}
      >
        <div className="max-w-[min(36rem,82%)] rounded-lg border border-primary/20 bg-primary px-4 py-3 text-sm leading-6 text-primary-foreground">
          {props.children}
        </div>
        <MessageAvatar label="U" className="bg-primary text-primary-foreground" />
      </div>
    );
  }

  if (props.variant === "agent-block") {
    return (
      <div
        data-variant="agent-block"
        className={cn("flex justify-start gap-3", props.className)}
      >
        <MessageAvatar label="A" />
        <div className="min-w-0 flex-1">
          <AgentInvocationBlock
            invocation={props.invocation}
            status={props.status}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      data-variant="agent-text"
      className={cn("flex justify-start gap-3", props.className)}
    >
      <MessageAvatar label="A" />
      <div className="max-w-[min(42rem,86%)] rounded-lg border border-border bg-card px-4 py-3 text-sm leading-6 text-card-foreground">
        {props.children}
      </div>
    </div>
  );
}

function MessageAvatar({
  label,
  className,
}: {
  label: string;
  className?: string;
}): ReactElement {
  return (
    <span
      aria-label={`${label} avatar`}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-mono text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}
