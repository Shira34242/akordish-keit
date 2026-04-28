import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class RequiredFieldFeedbackService {
  private initialized = false;
  private readonly message = 'שדה חובה';

  initGlobalValidation(): void {
    if (this.initialized || typeof document === 'undefined') return;
    this.initialized = true;

    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.tagName !== 'FORM') return;

      const firstInvalid = this.findFirstEmptyRequired(form);
      if (!firstInvalid) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      this.showRequired(firstInvalid);
    }, true);

    document.addEventListener('input', (event) => this.clearFromEvent(event), true);
    document.addEventListener('change', (event) => this.clearFromEvent(event), true);
  }

  validateRequiredFields(container: ParentNode): boolean {
    const firstInvalid = this.findFirstEmptyRequired(container);
    if (!firstInvalid) return true;

    this.showRequired(firstInvalid);
    return false;
  }

  showRequired(target: Element | null | undefined): void {
    if (!target) return;

    const anchor = this.getAnchor(target);
    this.clearFeedback(anchor);

    anchor.classList.add('ak-required-invalid');
    const group = this.getGroup(anchor);
    group?.classList.add('ak-required-group-invalid');

    const feedback = document.createElement('div');
    feedback.className = 'ak-required-feedback';
    feedback.textContent = this.message;
    feedback.setAttribute('role', 'alert');

    if (group) {
      group.appendChild(feedback);
    } else {
      anchor.insertAdjacentElement('afterend', feedback);
    }

    this.scrollAndFocus(anchor);
  }

  showRequiredBySelector(root: ParentNode, selector: string): void {
    this.showRequired(root.querySelector(selector));
  }

  clearFeedback(target: Element | null | undefined): void {
    if (!target) return;

    const group = this.getGroup(target);
    const scope = group ?? target.parentElement;
    scope?.querySelectorAll('.ak-required-feedback').forEach(item => item.remove());
    scope?.classList.remove('ak-required-group-invalid');
    target.classList.remove('ak-required-invalid');
  }

  private findFirstEmptyRequired(container: ParentNode): Element | null {
    const fields = Array.from(container.querySelectorAll<HTMLElement>(
      'input[required], textarea[required], select[required], [aria-required="true"], [data-required-field]'
    ));

    return fields.find(field => this.isEmpty(field) && this.isVisible(field)) ?? null;
  }

  private isEmpty(field: HTMLElement): boolean {
    if (field.hasAttribute('data-required-empty')) {
      return field.getAttribute('data-required-empty') === 'true';
    }

    if (field instanceof HTMLInputElement) {
      if (field.type === 'checkbox' || field.type === 'radio') {
        return !field.checked;
      }
      return !field.value.trim();
    }

    if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
      return !field.value.trim();
    }

    return false;
  }

  private isVisible(field: HTMLElement): boolean {
    return !!(field.offsetWidth || field.offsetHeight || field.getClientRects().length);
  }

  private getAnchor(target: Element): HTMLElement {
    const customAnchor = target.closest<HTMLElement>('[data-required-anchor]');
    return customAnchor ?? target as HTMLElement;
  }

  private getGroup(target: Element): HTMLElement | null {
    return target.closest<HTMLElement>(
      '.form-group, .key-field, .uploader-group, .field, .form-field, .input-group, .instrument-picker'
    );
  }

  private clearFromEvent(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    this.clearFeedback(this.getAnchor(target));
  }

  private scrollAndFocus(target: HTMLElement): void {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });

    const focusTarget = this.getFocusable(target);
    window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 250);
  }

  private getFocusable(target: HTMLElement): HTMLElement | null {
    if (this.canFocus(target)) return target;
    return target.querySelector<HTMLElement>('input, textarea, select, button, [tabindex]:not([tabindex="-1"])');
  }

  private canFocus(target: HTMLElement): boolean {
    return ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) || target.tabIndex >= 0;
  }
}
