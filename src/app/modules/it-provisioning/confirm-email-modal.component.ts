import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';

@Component({
  selector: 'app-confirm-email-modal',
  standalone: true,
  imports: [ModalComponent],
  templateUrl: './confirm-email-modal.component.html',
  styleUrl: './confirm-email-modal.component.scss',
})
export class ConfirmEmailModalComponent {
  visible       = input(false);
  candidateName = input('');
  email         = input('');
  confirmed = output<void>();
  closed    = output<void>();
}
