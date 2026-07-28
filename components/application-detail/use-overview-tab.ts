import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Application, Contact } from "./types";

/** All state + mutation logic for the Overview tab — notes autosave, follow-up reminder, contacts CRUD. */
export function useOverviewTab(app: Application, onUpdate: (patch: Partial<Application>) => void) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(app.notes ?? "");
  const [contacts, setContacts] = useState<Contact[]>(app.contacts ?? []);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteTimer, setNoteTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [reminderDate, setReminderDate] = useState(
    app.followUpAt ? new Date(app.followUpAt).toISOString().slice(0, 10) : ""
  );
  const [reminderSaving, setReminderSaving] = useState(false);

  // Sync if app prop changes
  useEffect(() => {
    setNotes(app.notes ?? "");
    setContacts(app.contacts ?? []);
    setReminderDate(app.followUpAt ? new Date(app.followUpAt).toISOString().slice(0, 10) : "");
  }, [app.id, app.notes, app.contacts, app.followUpAt]);

  const patchApp = useCallback(
    async (patch: object) => {
      const res = await fetch(`/api/applications/${app.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as { application: Application };
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      onUpdate(data.application);
      return data.application;
    },
    [app.id, queryClient, onUpdate]
  );

  // Debounced notes save
  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (noteTimer) clearTimeout(noteTimer);
    const t = setTimeout(async () => {
      setNoteSaving(true);
      try {
        await patchApp({ notes: value });
      } finally {
        setNoteSaving(false);
      }
    }, 1000);
    setNoteTimer(t);
  };

  const saveReminder = async (date: string) => {
    setReminderSaving(true);
    try {
      await patchApp({ followUpAt: date || null });
    } finally {
      setReminderSaving(false);
    }
  };

  const addContact = () => {
    setContacts([...contacts, { name: "", role: "", email: "", linkedin: "" }]);
  };

  const updateContact = (i: number, field: keyof Contact, value: string) => {
    setContacts(contacts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));
  };

  const removeContact = async (i: number) => {
    const updated = contacts.filter((_, idx) => idx !== i);
    setContacts(updated);
    await patchApp({ contacts: updated });
  };

  const saveContacts = async () => {
    await patchApp({ contacts });
  };

  return {
    notes,
    contacts,
    noteSaving,
    reminderDate,
    setReminderDate,
    reminderSaving,
    handleNotesChange,
    saveReminder,
    addContact,
    updateContact,
    removeContact,
    saveContacts,
  };
}
