import { Component ,HostListener} from '@angular/core';
interface NavItem {
  path: string;
  label: string;
  icon: string;
  exact?: boolean;
}
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],

})
export class HeaderComponent {

  navItems: NavItem[] = [
    { path: '/', label: 'Analyze', icon: '🔍', exact: true },
    { path: '/history', label: 'History', icon: '📜' },
    { path: '/admin', label: 'Admin', icon: '⚙️' }
  ];

  isMenuOpen: boolean = false;
  isScrolled: boolean = false;

  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 20;
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }
}
