'use client';

import { useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { INTEREST_GROUPS, MAX_INTERESTS } from '@/lib/preferences';

export function InterestPicker({ selected, onToggle }: { selected: string[]; onToggle: (topic: string) => void }) {
  const [search, setSearch] = useState('');
  const [custom, setCustom] = useState('');
  const [error, setError] = useState('');
  function addCustom() {
    const value = custom.trim().replace(/\s+/g, ' ');
    if (!value) return;
    if (selected.some((topic) => topic.toLowerCase() === value.toLowerCase())) {
      setError('That interest is already selected.');
      return;
    }
    if (selected.length >= MAX_INTERESTS) {
      setError(`Choose up to ${MAX_INTERESTS} interests.`);
      return;
    }
    onToggle(value);
    setCustom('');
    setError('');
  }
  const groups = INTEREST_GROUPS.map((group) => ({ ...group, topics: group.topics.filter((topic) => topic.toLowerCase().includes(search.toLowerCase().trim())) })).filter((group) => group.topics.length);
  return (
    <fieldset className="space-y-4">
      <legend className="mb-2 text-base font-semibold">What do you care about?</legend>
      <p className="text-sm text-muted-foreground">Pick a few favorites or get specific. {selected.length}/{MAX_INTERESTS} selected.</p>
      {selected.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Selected interests">
        {selected.map((topic) => <Button key={topic} type="button" variant="secondary" className="h-auto min-h-9 max-w-full whitespace-normal rounded-full px-3 py-1.5 text-left" onClick={() => onToggle(topic)} aria-label={`Remove ${topic}`}>{topic}<X className="size-3.5" aria-hidden="true" /></Button>)}
      </div>}
      <Label htmlFor="interest-search" className="sr-only">Search interests</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
        <Input id="interest-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search interests, e.g. space or soccer" className="h-11 bg-card pl-10" />
      </div>
      <div className="divide-y divide-border rounded-xl border border-border bg-card/60 px-4">
        {groups.map((group, index) => <details key={`${group.name}-${Boolean(search.trim())}`} open={search.trim() ? true : index === 0} className="py-3">
          <summary className="cursor-pointer py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">{group.name}</summary>
          <div className="mt-3 flex flex-wrap gap-2 pb-1">
            {group.topics.map((topic) => {
              const active = selected.some((item) => item.toLowerCase() === topic.toLowerCase());
              return <Button key={topic} type="button" variant={active ? 'default' : 'outline'} aria-pressed={active} disabled={!active && selected.length >= MAX_INTERESTS} onClick={() => onToggle(topic)} className="h-auto min-h-10 whitespace-normal rounded-full px-3 py-2 text-left">{active && <Check aria-hidden="true" />}{topic}</Button>;
            })}
          </div>
        </details>)}
        {!groups.length && <p className="py-4 text-sm text-muted-foreground">No matches. Add your own interest below.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="custom-interest">Something more specific?</Label>
        <div className="flex gap-2">
          <Input id="custom-interest" maxLength={50} value={custom} onChange={(event) => { setCustom(event.target.value); setError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addCustom(); } }} placeholder="e.g. robotics, WNBA, or indie games" className="h-11 bg-card" />
          <Button type="button" variant="outline" onClick={addCustom} disabled={!custom.trim()} className="h-11 px-3"><Plus aria-hidden="true" /> Add</Button>
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    </fieldset>
  );
}
