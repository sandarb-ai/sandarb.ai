'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface HeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

export function Header({ title, description, children }: HeaderProps) {
  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        {children}
      </div>
    </header>
  );
}

interface SearchHeaderProps {
  title: string;
  description?: string;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  children?: React.ReactNode;
}

export function SearchHeader({
  title,
  description,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  children,
}: SearchHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b bg-background px-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-64 pl-9"
          />
        </div>
        {children}
      </div>
    </header>
  );
}
