import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TextSubmissionInterfaceComponent } from './components/text-submission-interface/text-submission-interface.component';
import { LoginInterfaceComponent } from './components/login-interface/login-interface.component';
import { SignupInterfaceComponent } from './components/signup-interface/signup-interface.component';
import { ReviewInterfaceComponent } from './components/review-interface/review-interface.component';
import { HistoryInterfaceComponent } from './components/history-interface/history-interface.component';

const routes: Routes = [
  { path: 'text-submission', component: TextSubmissionInterfaceComponent },
  { path: 'login', component: LoginInterfaceComponent },
  { path: 'signup', component: SignupInterfaceComponent },
  { path: '', component: LoginInterfaceComponent },
  {path: 'review', component: ReviewInterfaceComponent},
  {path: 'history', component: HistoryInterfaceComponent}

];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
