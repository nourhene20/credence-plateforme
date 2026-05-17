import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TextSubmissionInterfaceComponent } from './components/text-submission-interface/text-submission-interface.component';



const routes: Routes = [
  { path: 'text-submission', component: TextSubmissionInterfaceComponent },
  { path: '', component: TextSubmissionInterfaceComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
