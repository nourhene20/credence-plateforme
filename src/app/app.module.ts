import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

import { TextSubmissionInterfaceComponent } 
from './components/text-submission-interface/text-submission-interface.component';
import { HttpClientModule } from '@angular/common/http';
import { LoginInterfaceComponent } from './components/login-interface/login-interface.component';
import { SignupInterfaceComponent } from './components/signup-interface/signup-interface.component';
import { ReviewInterfaceComponent } from './components/review-interface/review-interface.component';
import { HistoryInterfaceComponent } from './components/history-interface/history-interface.component';


@NgModule({
  declarations: [
    AppComponent,
    TextSubmissionInterfaceComponent,
    LoginInterfaceComponent,
    SignupInterfaceComponent,
    ReviewInterfaceComponent,
    HistoryInterfaceComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule,
    ReactiveFormsModule,
    CommonModule,
    HttpClientModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }