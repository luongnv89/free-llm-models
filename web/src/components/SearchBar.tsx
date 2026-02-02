import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ArrowUpDown } from 'lucide-react';
import type { SortField, SortOrder } from '@/types/model';

interface SearchBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField, order: SortOrder) => void;
  totalCount: number;
  filteredCount: number;
}

export function SearchBar({
  search,
  onSearchChange,
  sortField,
  sortOrder,
  onSortChange,
  totalCount,
  filteredCount,
}: SearchBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 pb-4 border-b border-border">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search models by name, description, or ID..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>
      <div className="flex items-center gap-2">
        <Select
          value={sortField}
          onValueChange={(v) => onSortChange(v as SortField, sortOrder)}
        >
          <SelectTrigger className="w-[140px]">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="provider">Provider</SelectItem>
            <SelectItem value="context_length">Context</SelectItem>
            <SelectItem value="created">Date Added</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="icon"
          onClick={() =>
            onSortChange(sortField, sortOrder === 'asc' ? 'desc' : 'asc')
          }
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          <span className="text-xs font-medium">
            {sortOrder === 'asc' ? 'A↑' : 'Z↓'}
          </span>
        </Button>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filteredCount} of {totalCount}
        </span>
      </div>
    </div>
  );
}
