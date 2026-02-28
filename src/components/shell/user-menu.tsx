'use client';

import Image from 'next/image';
import { useUser, useClerk } from '@clerk/nextjs';
import { ChevronUp, Settings, User, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface UserMenuProps {
  collapsed: boolean;
}

function UserAvatar({ user }: { user: ReturnType<typeof useUser>['user'] }) {
  if (user?.imageUrl) {
    return (
      <Image
        src={user.imageUrl}
        alt={user.firstName ?? 'User avatar'}
        width={28}
        height={28}
        className="flex-shrink-0"
        style={{ borderRadius: '7px' }}
      />
    );
  }

  const initial = user?.firstName?.charAt(0).toUpperCase() ?? '?';

  return (
    <span
      style={{
        width: '28px',
        height: '28px',
        borderRadius: '7px',
        background: 'linear-gradient(135deg, var(--accent-blue), #006fff)',
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initial}
    </span>
  );
}

export function UserMenu({ collapsed }: UserMenuProps) {
  const { user } = useUser();
  const { signOut } = useClerk();

  const displayName = user?.firstName
    ? user.lastName
      ? `${user.firstName} ${user.lastName}`
      : user.firstName
    : user?.emailAddresses?.[0]?.emailAddress ?? 'Account';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The border-top lives on the button itself. We reset the native button
            border via `border-0` Tailwind class, then re-apply just the top border
            through a separate inline style key so cascade order is correct. */}
        <button
          className={cn(
            'w-full flex items-center gap-[10px] outline-none border-0',
            'transition-colors duration-150',
            'hover:bg-[var(--bg-hover)]',
            collapsed ? 'justify-center px-0 py-3' : 'px-4 py-3',
          )}
          style={{
            borderTop: '1px solid var(--border-default)',
            cursor: 'pointer',
            background: 'none',
          }}
          aria-label="User menu"
        >
          <UserAvatar user={user} />

          {!collapsed && (
            <>
              <div className="flex flex-col items-start min-w-0 flex-1 overflow-hidden">
                <span
                  className="truncate w-full text-left"
                  style={{
                    fontSize: '12.5px',
                    fontWeight: 500,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.3,
                  }}
                >
                  {displayName}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-quaternary)',
                    lineHeight: 1.3,
                  }}
                >
                  Pro plan
                </span>
              </div>

              <ChevronUp
                style={{
                  width: '14px',
                  height: '14px',
                  color: 'var(--text-quaternary)',
                  flexShrink: 0,
                }}
              />
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className={cn(
          'min-w-[200px] p-1',
          'border shadow-lg',
        )}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer rounded-md"
          style={{ fontSize: '13px' }}
          onSelect={(e) => e.preventDefault()}
        >
          <User
            style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>Profile</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer rounded-md"
          style={{ fontSize: '13px' }}
          onSelect={(e) => e.preventDefault()}
        >
          <Settings
            style={{ width: '14px', height: '14px', color: 'var(--text-tertiary)' }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>Settings</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator
          style={{ background: 'var(--border-default)' }}
        />

        <DropdownMenuItem
          variant="destructive"
          className="flex items-center gap-2 cursor-pointer rounded-md"
          style={{ fontSize: '13px' }}
          onSelect={() => signOut()}
        >
          <LogOut style={{ width: '14px', height: '14px' }} />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
