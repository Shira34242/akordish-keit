import {
  MusicServiceProviderDto,
  MusicServiceProviderListDto,
  CreateMusicServiceProviderDto,
  UpdateMusicServiceProviderDto
} from './music-service-provider.model';
import { TeachingLanguage } from './teaching-language.enum';
import { TargetAudience } from './target-audience.enum';

export interface TeacherDto extends MusicServiceProviderDto {
  priceList?: string;
  languages?: TeachingLanguage;
  targetAudience?: TargetAudience;
  availability?: string;
  education?: string;
  lessonTypes?: string;
  specializations?: string;
  instruments: TeacherInstrumentDto[];
  testimonials?: TeacherTestimonialDto[];
}

export interface TeacherTestimonialDto {
  id?: number;
  studentName?: string;
  text: string;
  order: number;
}

export interface TeacherListDto extends MusicServiceProviderListDto {
  instrumentsCount: number;
  primaryInstrument?: string;
  instrumentIds: number[];
  languages?: TeachingLanguage;
  targetAudience?: TargetAudience;
}

export interface CreateTeacherDto extends CreateMusicServiceProviderDto {
  priceList?: string;
  languages?: TeachingLanguage;
  targetAudience?: TargetAudience;
  availability?: string;
  education?: string;
  lessonTypes?: string;
  specializations?: string;
  instruments: CreateTeacherInstrumentDto[];
  testimonials?: CreateTeacherTestimonialDto[];
}

export interface UpdateTeacherDto extends UpdateMusicServiceProviderDto {
  priceList?: string;
  languages?: TeachingLanguage;
  targetAudience?: TargetAudience;
  availability?: string;
  education?: string;
  lessonTypes?: string;
  specializations?: string;
  instruments: CreateTeacherInstrumentDto[];
  testimonials?: CreateTeacherTestimonialDto[];
}

export interface CreateTeacherTestimonialDto {
  studentName?: string;
  text: string;
  order: number;
}

export interface TeacherInstrumentDto {
  id: number;
  instrumentId: number;
  instrumentName: string;
  isPrimary: boolean;
}

export interface CreateTeacherInstrumentDto {
  instrumentId: number;
  isPrimary: boolean;
}
