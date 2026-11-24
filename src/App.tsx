import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CalendarDays, Check, ChevronDown, CircleHelp, DraftingCompass, FolderClosed, Globe2, LayoutDashboard, ListTodo, Menu, Search, Settings2, Users, X } from 'lucide-react';
import { AppContext } from './context';
import { useStudio } from './useStudio';
import { translator } from './i18n';
import type { Lang } from './types';
import { Avatar, Modal } from './components';
import { Auth, Onboarding } from './Auth';
import { Calendar, Overview, ProjectDetail, Projects, SearchResults, Settings, Team } from './screens';
import { Tasks } from './TaskViews';
import { errorMessage } from './utils';
import { parseRoute } from './workspaceRoutes';
import { useTheme } from './theme';
import { Landing } from './Landing';

export default function App() {
  const studio = useStudio();
  const { theme, setTheme } = useTheme();
  const [lang, changeLang] = useState<Lang>(() => localStorage.getItem('studio-language') === 'ar' ? 'ar' : 'en');
  const [narrow, setNarrow] = useState(() => matchMedia('(max-width: 850px)').matches);
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  const { path, params } = route;
  const [mobile, setMobile] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const [modal, setModal] = useState<{ title: string; body: ReactNode; workspace: string; returnFocus: HTMLElement | null } | null>(null);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(null); const [busy, setBusy] = useState(false); const busyRef = useRef(false);
  const t = translator(lang);
  const [token, setToken] = useState(() => {
    const fromLink = location.hash.startsWith('#/invite?') ? new URLSearchParams(location.hash.split('?')[1]).get('token') : null;
    if (fromLink) sessionStorage.setItem('studio-invitation', fromLink);
    return fromLink || sessionStorage.getItem('studio-invitation');
  });
  const navigate = useCallback((next: string) => { location.hash = next; setMobile(false); }, []);
  const dismissInvitation = () => { sessionStorage.removeItem('studio-invitation'); setToken(null); navigate('/overview'); };
  const closeModal = useCallback(() => setModal(null), []);
  const run = useCallback(async (action: () => Promise<unknown> | unknown, message?: string, close = false) => {
    if (busyRef.current) return false;
    busyRef.current = true; setBusy(true);
    try { await action(); if (message) setToast({ text: message, error: false }); if (close) setModal(null); return true; }
    catch (e) { setToast({ text: errorMessage(e), error: true }); return false; }
    finally { busyRef.current = false; setBusy(false); }
  }, []);
  useEffect(() => {
    const hash = () => {
      const next = parseRoute(location.hash);
      setRoute(next);
      if (next.path === '/invite') {
        const incoming = next.params.get('token');
        if (incoming) { sessionStorage.setItem('studio-invitation', incoming); setToken(incoming); }
      }
      setModal(null);
      setMobile(false);
      if (next.path !== path) {
        window.scrollTo(0, 0);
        requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
      }
    };
    window.addEventListener('hashchange', hash); return () => window.removeEventListener('hashchange', hash);
  }, [path]);
  useEffect(() => { const media = matchMedia('(max-width: 850px)'); const resize = () => setNarrow(media.matches); media.addEventListener('change', resize); return () => media.removeEventListener('change', resize); }, []);
  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'; localStorage.setItem('studio-language', lang); }, [lang]);
  useEffect(() => { if (!toast || toast.error) return; const timeout = setTimeout(() => setToast(null), 4500); return () => clearTimeout(timeout); }, [toast]);
  const dismissDrawer = () => {
    setMobile(false);
    requestAnimationFrame(() => menuRef.current?.focus());
  };
  const followSidebarLink = () => {
    if (mobile && narrow) requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
    setMobile(false);
  };
  useEffect(() => {
    if (!mobile || !narrow) return;
    drawerCloseRef.current?.focus();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissDrawer();
      if (event.key !== 'Tab') return;
      const controls = navRef.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)');
      const first = controls?.[0];
      const last = controls?.[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => { document.body.style.overflow = before; window.removeEventListener('keydown', handleKey); };
  }, [mobile, narrow]);
  const workspace = `${studio.data.profile.id}:${studio.data.studio?.id ?? ''}`;
  useEffect(() => {
    setModal(previous => previous?.workspace === workspace ? previous : null);
  }, [workspace]);
  const activeModal = modal?.workspace === workspace ? modal : null;
  const openModal = (title: string, body: ReactNode) => {
    const target = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setToast(null);
    setModal({ title, body, workspace, returnFocus: activeModal?.returnFocus ?? target });
  };
  const openSearch = () => openModal(t('Search'), <SearchResults/>);
  const navigation = [
    { path: '/overview', label: 'Overview', icon: LayoutDashboard }, { path: '/projects', label: 'Projects', icon: FolderClosed }, { path: '/tasks', label: 'My tasks', icon: ListTodo }, { path: '/calendar', label: 'Calendar', icon: CalendarDays }, { path: '/team', label: 'Team', icon: Users },
  ];
  const content = path.startsWith('/projects/') ? <ProjectDetail key={path} id={path.split('/')[2]}/> : path === '/projects' ? <Projects/> : path === '/tasks' ? <Tasks/> : path === '/calendar' ? <Calendar/> : path === '/team' ? <Team/> : path === '/settings' ? <Settings/> : <Overview/>;
  const hasStudio = Boolean(studio.data.studio);
  const initial = !studio.ready || studio.loading && !hasStudio;
  const auth = !studio.demo && (!studio.session || studio.recovery);
  return <AppContext.Provider value={{ studio, lang, setLang: changeLang, t, theme, setTheme, navigate, params, busy, openModal, closeModal, run }}>
    {initial ? <div className="loading-screen"><DraftingCompass size={32}/><p>{t('Loading your studio…')}</p></div> : !studio.session && (!location.hash && !location.search || path === '/welcome') ? <Landing/> : auth || !studio.session && ['/signin', '/signup'].includes(path) ? <Auth key={path}/> : studio.error && !hasStudio ? <div className="onboarding"><h1>{t('Something went wrong')}</h1><p role="alert">{t(studio.error)}</p><button className="button primary" onClick={() => void run(studio.refresh)}>{t('Retry')}</button><button className="text-button" onClick={() => void run(studio.signOut)}>{t('Sign out')}</button></div> : !hasStudio ? <Onboarding token={token} dismissInvitation={dismissInvitation}/> : <div className="app-shell" inert={Boolean(activeModal)}>
      <a href="#main" className="skip-link" tabIndex={mobile && narrow ? -1 : undefined} onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>{t('Skip to content')}</a>
      {mobile && <button tabIndex={-1} aria-label={t('Close navigation')} className="sidebar-backdrop" onClick={dismissDrawer}/>}
      <aside ref={navRef} id="studio-navigation" inert={narrow && !mobile} aria-hidden={narrow && !mobile ? true : undefined} className={`sidebar ${mobile ? 'is-open' : ''}`}>
        {narrow && <button ref={drawerCloseRef} className="icon-button drawer-close" aria-label={t('Close navigation')} onClick={dismissDrawer}><X size={20}/></button>}
        <a className="brand" href="#/overview" onClick={followSidebarLink}><span className="brand-symbol"><DraftingCompass size={24}/></span><span>archi<span className="brand-light">flow</span></span></a>
        <button className="studio-switcher" onClick={() => navigate('/settings')}><span className="studio-mark">{studio.data.studio!.name[0].toUpperCase()}</span><span><strong>{studio.data.studio!.name}</strong><small>{t('Studio workspace')}</small></span><Settings2 size={15}/></button>
        <nav aria-label={t('Workspace')}>{navigation.map(item => {
          const active = path === item.path || item.path === '/projects' && path.startsWith('/projects/');
          return <a key={item.path} href={`#${item.path}`} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined} onClick={followSidebarLink}><item.icon size={18}/><span>{t(item.label)}</span></a>;
        })}</nav>
        <div className="sidebar-bottom"><a aria-current={path === '/settings' ? 'page' : undefined} className={path === '/settings' ? 'active settings-link' : 'settings-link'} href="#/settings" onClick={() => setMobile(false)}><Settings2 size={18}/>{t('Settings')}</a><div className="sidebar-profile"><Avatar name={studio.data.profile.full_name}/><span><strong>{studio.data.profile.full_name}</strong><small>{t(studio.data.studio!.owner_id === studio.data.profile.id ? 'Owner' : 'Member')}</small></span><button className="icon-button" aria-label={t('Profile')} onClick={() => navigate('/settings')}><ChevronDown size={15}/></button></div></div>
      </aside>
      <div className="main-shell" inert={mobile && narrow}><header className="topbar"><div className="topbar-left"><button ref={menuRef} className="icon-button mobile-menu" aria-expanded={mobile} aria-controls="studio-navigation" aria-label={t('Open navigation')} onClick={() => setMobile(true)}><Menu size={22}/></button><span className="breadcrumb">{t('Workspace')}<span>/</span><strong>{t(path.startsWith('/projects/') ? 'Projects' : navigation.find(n => n.path === path)?.label ?? (path === '/settings' ? 'Settings' : 'Overview'))}</strong></span></div><div className="topbar-actions"><button type="button" className="search-trigger" aria-haspopup="dialog" onClick={openSearch}><Search size={17}/>{t('Search')}</button><button className="language-button" aria-label={lang === 'en' ? 'العربية' : 'English'} onClick={() => changeLang(lang === 'en' ? 'ar' : 'en')}><Globe2 size={16}/><span>{lang === 'en' ? 'العربية' : 'English'}</span></button><span className="topbar-divider"/><button className="profile-button" aria-label={t('Profile')} onClick={() => navigate('/settings')}><Avatar name={studio.data.profile.full_name} small/></button></div></header>
      {studio.demo && <div className="demo-banner"><span><span className="demo-pill">{t('Demo workspace')}</span><span className="demo-explanation">{t('Saved on this device')}</span></span><button onClick={studio.leaveDemo}>{t('Connect your studio')}</button></div>}
      {!studio.online && !studio.demo && <div role="alert" className="offline-banner">{t('You are offline. Reconnect before saving changes.')}</div>}
      {studio.error && <div className="offline-banner" role="status">{t('Your workspace may be out of date.')} <button className="text-button" disabled={studio.syncing} onClick={() => void studio.refresh()}>{t('Retry sync')}</button></div>}
      {path === '/invite' && token ? <div className="invitation-notice"><CircleHelp size={20}/><span>{t(studio.demo ? 'Demo data stays in this browser. Connect Supabase for real team collaboration.' : 'Already in a studio')}</span><button className="button secondary" onClick={dismissInvitation}>{t('Continue')}</button></div> : null}
      <main id="main" tabIndex={-1} aria-busy={busy} className="main-content">{content}</main></div>
    </div>}
    {activeModal && <Modal title={activeModal.title} returnFocus={activeModal.returnFocus} onClose={closeModal}>{activeModal.body}</Modal>}
    {toast && <div role={toast.error ? 'alert' : 'status'} className={`toast ${toast.error ? 'error-toast' : ''}`}>{!toast.error && <Check size={17}/>}<span>{t(toast.text)}</span><button className="icon-button" aria-label={t('Close')} onClick={() => setToast(null)}><X size={17}/></button></div>}
  </AppContext.Provider>;
}
