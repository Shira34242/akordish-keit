import { Pipe, PipeTransform } from '@angular/core';
import { LanguageService } from '../services/language.service';

@Pipe({
  name: 'translate',
  pure: false,
  standalone: true
})
export class TranslatePipe implements PipeTransform {
  constructor(private langService: LanguageService) {}

  transform(key: string): string {
    return this.langService.translate(key);
  }
}
