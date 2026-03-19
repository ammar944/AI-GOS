'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteJourneySession } from '@/lib/actions/journey-sessions'

interface DeleteSessionButtonProps {
  sessionId: string
  sessionTitle: string
}

export function DeleteSessionButton({ sessionId, sessionTitle }: DeleteSessionButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    startTransition(async () => {
      const result = await deleteJourneySession(sessionId)
      if (result.success) {
        setOpen(false)
        router.refresh()
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(true)
          }}
          className="cursor-pointer rounded-lg p-1.5 text-[var(--text-quaternary)] opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 group-hover:opacity-100"
          aria-label={`Delete ${sessionTitle}`}
        >
          <Trash2 className="size-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-[var(--border-default)] bg-[var(--bg-elevated)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[var(--text-primary)]">Delete research?</AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--text-tertiary)]">
            This will permanently delete <span className="font-medium text-[var(--text-secondary)]">{sessionTitle}</span> and all its research data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            className="cursor-pointer border-[var(--border-default)] bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            disabled={isPending}
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isPending}
            className="cursor-pointer border-0 bg-red-600 text-white hover:bg-red-700"
          >
            {isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
