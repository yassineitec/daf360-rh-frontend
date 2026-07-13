import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';
import { ButtonComponent } from '@khalilrebhiitec/daf360';

@Component({
  selector: 'app-confirm-submit-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent],
  templateUrl: './confirm-submit-modal.component.html',
  styleUrl: './confirm-submit-modal.component.scss',
})
export class ConfirmSubmitModalComponent {
  visible       = input(false);
  firstName     = input('');
  lastName      = input('');
  ms365Email    = input('');
  submitting    = input(false);
  confirmed = output<void>();
  closed    = output<void>();
}
