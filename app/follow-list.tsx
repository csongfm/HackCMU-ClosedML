'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function FollowList({ id, label, hint, placeholder, items: providedItems, limit, onChange }: {
  id: string; label: string; hint: string; placeholder: string; items?: string[] | null; limit: number; onChange: (items: string[]) => void;
}) {
  const items = providedItems ?? [];
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  function add() {
    const value = draft.trim().replace(/\s+/g, ' ');
    if (!value) return;
    if (items.some((item) => item.toLowerCase() === value.toLowerCase())) { setError('Already added.'); return; }
    if (items.length >= limit) { setError(`You can add up to ${limit}. Remove an entry first.`); return; }
    onChange([...items, value]);
    setDraft('');
    setError('');
  }
  return <div className="space-y-2.5">
    <Label htmlFor={id}>{label}<span className="font-normal text-muted-foreground">(optional)</span></Label>
    <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint} {items.length}/{limit} added.</p>
    <div className="flex gap-2">
      <Input id={id} value={draft} maxLength={100} aria-describedby={`${id}-hint`} placeholder={placeholder} onChange={(event) => { setDraft(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} className="h-11 bg-card" />
      <Button type="button" variant="outline" onClick={add} disabled={!draft.trim()} className="h-11 px-3" aria-label={`Add to ${label.toLowerCase()}`}><Plus aria-hidden="true" />Add</Button>
    </div>
    {draft.trim() && <p className="text-sm text-muted-foreground">Press Enter or Add to include this entry before saving.</p>}
    {items.length > 0 && <div className="flex flex-wrap gap-2" aria-label={label}>{items.map((item) => <Button key={item} type="button" variant="secondary" className="h-auto min-h-9 max-w-full whitespace-normal rounded-full px-3 py-1.5 text-left" aria-label={`Remove ${item} from ${label.toLowerCase()}`} onClick={() => { onChange(items.filter((value) => value !== item)); setError(''); }}>{item}<X aria-hidden="true" /></Button>)}</div>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
