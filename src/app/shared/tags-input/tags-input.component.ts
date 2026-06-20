import { Component, computed, input, output, signal } from '@angular/core';

@Component({
  selector: 'app-tags-input',
  standalone: true,
  templateUrl: './tags-input.component.html',
  styleUrl: './tags-input.component.scss',
})
export class TagsInputComponent {
  tags        = input<string[]>([]);
  tagsChange  = output<string[]>();
  suggestions = input<string[]>([]);
  placeholder = input('Ajouter un tag…');
  color       = input('#3b82f6');

  inputValue      = signal('');
  showSuggestions = signal(false);

  filteredSuggestions = computed(() => {
    const val     = this.inputValue().toLowerCase().trim();
    const current = new Set(this.tags());
    return this.suggestions()
      .filter(s => !current.has(s) && (val === '' || s.toLowerCase().includes(val)))
      .slice(0, 8);
  });

  onInput(event: Event): void {
    this.inputValue.set((event.target as HTMLInputElement).value);
    this.showSuggestions.set(true);
  }

  onKeydown(event: KeyboardEvent, inputEl: HTMLInputElement): void {
    const val = this.inputValue().trim();
    if ((event.key === 'Enter' || event.key === ',') && val) {
      event.preventDefault();
      this.addTag(val);
      inputEl.value = '';
      this.inputValue.set('');
    } else if (event.key === 'Backspace' && !val) {
      const t = [...this.tags()];
      if (t.length > 0) {
        t.pop();
        this.tagsChange.emit(t);
      }
    }
  }

  addTag(tag: string): void {
    const clean = tag.replace(/,/g, '').trim();
    if (!clean) return;
    const current = this.tags();
    if (current.includes(clean)) return;
    this.tagsChange.emit([...current, clean]);
    this.showSuggestions.set(false);
  }

  removeTag(index: number): void {
    const t = [...this.tags()];
    t.splice(index, 1);
    this.tagsChange.emit(t);
  }

  pickSuggestion(sug: string, inputEl: HTMLInputElement): void {
    this.addTag(sug);
    inputEl.value = '';
    this.inputValue.set('');
    this.showSuggestions.set(false);
  }

  onFocus(): void  { this.showSuggestions.set(true); }
  onBlur(): void   { setTimeout(() => this.showSuggestions.set(false), 150); }
}
