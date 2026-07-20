import { Component, input, output } from '@angular/core';
import { ModalComponent } from '../../shared/modal.component';
import { ButtonComponent } from '@khalilrebhiitec/daf360';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-confirm-email-modal',
  standalone: true,
  imports: [ModalComponent, ButtonComponent, TranslatePipe],
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
