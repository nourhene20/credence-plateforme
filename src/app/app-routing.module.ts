import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TextSubmissionInterfaceComponent } from './components/text-submission-interface/text-submission-interface.component';
import { HistoryComponent } from './components/history/history.component';
import { AdminComponent } from './components/admin/admin.component';


const routes: Routes = [
  { path: 'text-submission', component: TextSubmissionInterfaceComponent },
  { path: '', component: TextSubmissionInterfaceComponent },
  { path: 'history', component: HistoryComponent },
  {path: 'admin', component: AdminComponent}
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
