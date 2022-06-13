import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, finalize } from 'rxjs/operators';

import { environment } from '@environments/environment';
import { Role } from '@app/_models';

const baseUrl = `${environment.apiUrl}/roles`;

@Injectable({ providedIn: 'root' })
export class RoleService {
    private RoleSubject: BehaviorSubject<Role>;
    public role: Observable<Role>;

    constructor(
        private router: Router,
        private http: HttpClient
    ) {
        this.RoleSubject = new BehaviorSubject<Role>(null);
        this.role = this.RoleSubject.asObservable();
    }

    public get roleValue(): Role {
        return this.RoleSubject.value;
    }

    login(email: string, password: string) {
        return this.http.post<any>(`${baseUrl}/authenticate`, { email, password }, { withCredentials: true })
            .pipe(map(role => {
                this.RoleSubject.next(role);
                this.startRefreshTokenTimer();
                return role;
            }));
    }

    logout() {
        this.http.post<any>(`${baseUrl}/revoke-token`, {}, { withCredentials: true }).subscribe();
        this.stopRefreshTokenTimer();
        this.RoleSubject.next(null);
        this.router.navigate(['/role/login']);
    }

    refreshToken() {
        return this.http.post<any>(`${baseUrl}/refresh-token`, {}, { withCredentials: true })
            .pipe(map((role) => {
                this.RoleSubject.next(role);
                this.startRefreshTokenTimer();
                return role;
            }));
    }

    register(role: Role) {
        return this.http.post(`${baseUrl}/register`, role);
    }

    verifyEmail(token: string) {
        return this.http.post(`${baseUrl}/verify-email`, { token });
    }
    
    forgotPassword(email: string) {
        return this.http.post(`${baseUrl}/forgot-password`, { email });
    }
    
    validateResetToken(token: string) {
        return this.http.post(`${baseUrl}/validate-reset-token`, { token });
    }
    
    resetPassword(token: string, password: string, confirmPassword: string) {
        return this.http.post(`${baseUrl}/reset-password`, { token, password, confirmPassword });
    }

    getAll() {
        return this.http.get<Role[]>(baseUrl);
    }

    getById(id: string) {
        return this.http.get<Role>(`${baseUrl}/${id}`);
    }
    
    create(params) {
        return this.http.post(baseUrl, params);
    }
    
    update(id, params) {
        return this.http.put(`${baseUrl}/${id}`, params)
            .pipe(map((role: any) => {
                // update the current role if it was updated
                if (role.id === this.roleValue.id) {
                    // publish updated role to subscribers
                    role = { ...this.roleValue, ...role };
                    this.RoleSubject.next(role);
                }
                return role;
            }));
    }
    
    delete(id: string) {
        return this.http.delete(`${baseUrl}/${id}`)
            .pipe(finalize(() => {
                // auto logout if the logged in role was deleted
                if (id === this.roleValue.id)
                    this.logout();
            }));
    }

    // helper methods

    private refreshTokenTimeout;

    private startRefreshTokenTimer() {
        // parse json object from base64 encoded jwt token
        const jwtToken = JSON.parse(atob(this.roleValue.jwtToken.split('.')[1]));

        // set a timeout to refresh the token a minute before it expires
        const expires = new Date(jwtToken.exp * 1000);
        const timeout = expires.getTime() - Date.now() - (60 * 1000);
        this.refreshTokenTimeout = setTimeout(() => this.refreshToken().subscribe(), timeout);
    }

    private stopRefreshTokenTimer() {
        clearTimeout(this.refreshTokenTimeout);
    }
}